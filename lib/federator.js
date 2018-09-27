/* 
 * federator/lib/federator.js
 *
 * Federator webserver handling and delegating requests 
 * 
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

"use strict";

const url = require("url");
const querystring = require("querystring");

const RequestManager = require("./lib/threading/threadManager");

// Routes to be included
const routes = require("./routes");

const __VERSION__ = "1.0.0";

function federator(request, response) {

  const SERVICE_CLOSED = false;

  if(SERVICE_CLOSED) {
    return response.end("Service is closed.");
  }

  // The request manager is attached to follow the request
  request.streamManager = new RequestManager();

  // Patch the response write function to track number of bytes shipped
  response.bytesWritten = 0;
  response.write = (function(closure) {
    return function(chunk) {
      response.bytesWritten += chunk.length;
      return closure.apply(this, arguments);
    }
  })(response.write);

  // The request was closed by the client: kill any staged requests 
  request.on("close", request.streamManager.kill.bind(request.streamManager));

  // Handles when response is finished
  response.on("finish", request.streamManager.finish.bind(request.streamManager, request, response));
  response.on("close", response.emit.bind(response, "finish"));

  // Handle the incoming request
  switch(request.method) {
    case "GET":
      return handleGETRequest(request, response);
    case "POST":
      return handlePOSTRequest(request, response);
    default:
      response.writeHeader(400);
      return response.end("Method not implemented.");
  }

}

function handlePOSTRequest(request, response) {

  /* FUNCTION handlePOSTRequest
   * Handles POST request body parsing
   */

  // Collect the POST chunks
  var chunks = new Array();

  request.on("data", function(data) {
    chunks.push(data);
  });

  request.on("end", function() {

    // Convert to text and split by lines
    var requestBody = Buffer.concat(chunks).toString().split("\n");

    request.query = extractQueryPOST(requestBody);
    request.segments = extractStreamLines(requestBody);

    // Callback to continue the request
    if(request.segments.length === 0) {
      return response.end("No segments given.");
    }

    handleRoute(request, response);

  });

}

function extractStreamLines(data) {

  /* FUNCTION extractStreamLines
   * Extracts stream lines from the POST body
   */

  return data.filter(function(x) {
    return x.length && !x.includes("=");
  });

}

function extractQueryPOST(data) {

  /* Function extractQueryPOST
   * Extracts key=value parameters from post body
   */

  var query = new Object();
  
  data.filter(function(x) {
    return x.includes("=");
  }).forEach(function(x) {
    var keyValue = x.split("=");
    query[keyValue[0]] = keyValue[1];
  });

  return query;

}

function handleGETRequest(request, response) {

  /* FUNCTION handleGETRequest
   * Parses the query string and continues synchronously
   */

  // Set the query
  request.query = querystring.parse(url.parse(request.url).query);

  handleRoute(request, response);

}

function handleRoute(request, response) {

  /* function handleRoute
   * Routes the request to the appopriate function
   */

  // Forward the request
  switch(url.parse(request.url).pathname) {
    case "/fdsnws/dataselect/1/query":
      return routes.queryDataselect(request, response);
    case "/fdsnws/station/1/query":
      return routes.queryStation(request, response);
    case "/fdsnws/dataselect/1/version":
      return routes.versionDataselect(request, response);
    case "/fdsnws/station/1/version":
      return routes.versionStation(request, response);
    case "/fdsnws/station/1/application.wadl":
      return routes.wadlStation(request, response);
    case "/fdsnws/dataselect/1/application.wadl":
      return routes.wadlDataselect(request, response);
    default:
      return routes.notFound(request, response);
  }

}

module.exports.server = federator;
module.exports.__VERSION__ = __VERSION__;
