/* federator/lib/router.js
 * 
 * Routes requests through the EIDAWS Routing Service
 *
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

"use strict";

const http = require("http");
const querystring = require("querystring");

function routingRequest(request, callback) {

  /* FUNCTION routingRequest
   * Creates routing query
   */

  // Delegate to the appropriate function
  switch(request.method) {
    case "GET":
      return GETRoutingRequest(request.query, callback);
    case "POST":
      return POSTRoutingRequest(request.segments, request.query, callback);
    default:
      return response.end();
  }

}

function HTTPResponseCallback(response, userQuery, callback) {

  /* FUNCTION HTTPResponseCallback
   * Attempts POST request to the routing service
   */

  var chunks = new Array();

  response.on("data", function(chunk) {
    chunks.push(chunk);
  });

  response.on("end", function() {

    if(response.statusCode === 204) {
      return callback(null, chunks);
    }

    // Means there was an error
    if(response.statusCode !== 200) {
      return callback(true, null);
    }

    // Determine whether we can bundle multiple networks (in case of low overhead)
    // Bundle requests by stations for a single data center
    var routingResponse = bundleRoutes(JSON.parse(Buffer.concat(chunks)), userQuery);

    callback(null, routingResponse);

  });

}

function POSTRoutingRequest(streamLines, userQuery, callback) {

  /* FUNCTION POSTRoutingRequest
   * Attempts POST request to the routing service
   */

  // Add default parameters for the routing request
  var defaultRequestParameters = [
    "service=station",
    "format=json"
  ];

  var streamLines = defaultRequestParameters.concat(streamLines).join("\n");

  const requestOptions = {
    "hostname": "www.orfeus-eu.org",
    "port": 80,
    "path": "/eidaws/routing/1/query",
    "method": "POST",
    "headers": {
      "Content-Length": streamLines.length
    }
  }

  // Open the request and write data
  const request = http.request(requestOptions, function(response) {
    HTTPResponseCallback(response, userQuery, callback);
  });

  // Forward the stream line POST body to the routing service
  request.write(streamLines);
  request.end();

}

function createRoutingQuery(userQuery) {

  /* FUNCTION createRoutingQuery
   * Creates the routing query
   */

  var queryObject = {
    "service": "station",
    "format": "json"
  }

  // Make sure to handle the annoying abbrevations
  if(userQuery.network || userQuery.net) {
    queryObject.network = userQuery.network || userQuery.net;
  }
  if(userQuery.station || userQuery.sta) {
    queryObject.station = userQuery.station || userQuery.sta;
  }
  if(userQuery.location || userQuery.loc) {
    queryObject.location = userQuery.location || userQuery.loc;
  } 
  if(userQuery.channel || userQuery.cha) {
    queryObject.channel = userQuery.channel || userQuery.cha;
  } 
  if(userQuery.start || userQuery.starttime) {
    queryObject.start = userQuery.start || userQuery.starttime;
  } 
  if(userQuery.end || userQuery.endtime) {
    queryObject.end = userQuery.end || userQuery.endtime;
  } 

  return queryObject;

}

function GETRoutingRequest(userQuery, callback) {

  /* FUNCTION GETRoutingRequest
   * Wrapper for GET request to the EIDA routing service
   */

  userQuery = createRoutingQuery(userQuery);

  const requestOptions = {
    "hostname": "www.orfeus-eu.org",
    "port": 80,
    "path": "/eidaws/routing/1/query?" + querystring.stringify(userQuery),
    "method": "GET"
  }
  // Make and end the request immediately
  const request = http.request(requestOptions, function(response) {
    HTTPResponseCallback(response, userQuery, callback);
  });

  request.end();

}

function shouldBundleNetworks(userQuery) {

  /* FUNCTION shouldBundleNetworks
   * Determines whether network requests should be bundled
   */

  return !userQuery.level || userQuery.level === "network" || userQuery.level === "station";

}

function createQueryObject(parameters) {

  /* FUNCTION createQueryObject
   * Creates a stream object
   */

  return {
    "sta": parameters.sta,
    "cha": parameters.cha,
    "loc": parameters.loc,
    "net": parameters.net
  }

}

function specialRequestCache(json, userQuery) {

  /* FUNCTION specialRequestCache
   * Returns special cases that can be heavily optimized
   * e.g. when the whole inventory from a node is being requested
   */

  // An edge case when everything is requested
  if((!userQuery.network || userQuery.network === "*") && (!userQuery.station || userQuery.station === "*")) {
    return json.map(function(datacenter) {
      return {
        "url": datacenter.url,
        "params": [{
          "net": "*",
          "sta": "*",
          "loc": datacenter.params[0].loc,
          "cha": datacenter.params[0].cha
        }]
      }
    });

  }

  return null;

}

function bundleRoutes(json, userQuery) {

  /* FUNCTION bundleRoutes
   * Merges multiple routes that can be combined to a single query
   * e.g. "www.orfeus-eu.org?net=NL" and "www.orfeus-eu.org?net=NR"
   * can be combined to "www.orfeus-eu.org?net=NL,NR" at the SAME data center
   * Only do this for high-level request or risk a 413 Payload Too Large
   *
   * We always bundle stations from the same network to the same request
   */

  // Check the special request cache for this request
  var requestCache = specialRequestCache(json, userQuery);

  if(requestCache !== null) {
    return requestCache;
  }

  // Determine whether we can bundle multiple networks (in case of low overhead)
  var bundleNetworks = shouldBundleNetworks(userQuery);

  return json.map(function(datacenter) {

    var networks = new Object();

    // Sort the stations to routes
    datacenter.params.forEach(function(parameters) {

      // Bundle networks when required and the station is a wildcard 
      if(bundleNetworks && parameters.sta === "*") {

        if(!networks.hasOwnProperty("*")) {
          networks["*"] = createQueryObject(parameters);
        } else {
          networks["*"].net += "," + parameters.net;
        }

      } else {

        // Bundle stations
        var identifier = parameters.net;

        // Add others
        if(!networks.hasOwnProperty(identifier)) {
          networks[identifier] = createQueryObject(parameters);
        } else {
          networks[identifier].sta += "," + parameters.sta;
        }

      }

    });

    // Set the new datacenter routes
    return {
      "url": datacenter.url,
      "params": Object.values(networks)
    }

  });

}

module.exports = routingRequest;
