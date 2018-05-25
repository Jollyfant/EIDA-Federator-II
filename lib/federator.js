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

const RequestManager = require("./threadManager");

// Routes to be included
const routes = require("../routes");

// Callback fired on connection
function federator(request, response) {

    const SERVICE_CLOSED = false;

    if(SERVICE_CLOSED) {
      return response.end("Service is closed.");
    }

    if(request.method !== "GET") {
      return response.end("Request method not implemented.");
    }

    // The request manager is attached to follow the request
    request.streamManager = new RequestManager();

    // Parse the query parameters to an key-pair object
    request.query = querystring.parse(url.parse(request.url).query);

    // The request was closed by the client: kill any staged requests 
    request.on("close", request.streamManager.kill.bind(request.streamManager));

    // Handles when response is finished
    response.on("finish", request.streamManager.finish.bind(request.streamManager, request, response));
    response.on("close", response.emit.bind(response, "finish"));

    // Forward the request
    switch(url.parse(request.url).pathname) {
      case "/fdsnws/dataselect/1/query":
        return routes.dataselectRoute(request, response);
      case "/fdsnws/station/1/query":
        return routes.stationRoute(request, response);
      default:
        return response.end("Route not implemented.");
    }

}

module.exports = federator;
