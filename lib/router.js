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

  // Delegate to another function
  HTTPRequest(request.query, callback);

}

function createRoutingQuery(userQuery) {

  /* FUNCTION createRoutingQuery
   * Creates the routing query
   */

  const ROUTING_URL = "http://www.orfeus-eu.org/eidaws/routing/1/query";

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

  return ROUTING_URL + "?" + querystring.stringify(queryObject);

}

function HTTPRequest(userQuery, callback) {

  /* FUNCTION HTTPRequest
   * Wrapper for HTTP requests
   */

  http.get(createRoutingQuery(userQuery), function(response) {

    var chunks = new Array();

    response.on("data", function(chunk) {
      chunks.push(chunk);
    });

    response.on("end", function() {

      if(response.statusCode === 204) {
        return callback(null, new Array());
      }

      // Means there was an error
      if(response.statusCode !== 200) {
        return callback(true);
      }

      // Determine whether we can bundle multiple networks (in case of low overhead)
      var shouldBundle = shouldBundleNetworks(userQuery);

      // Bundle requests by stations for a single data center
      var routingResponse = bundleRoutes(JSON.parse(Buffer.concat(chunks)), shouldBundle);

      callback(null, routingResponse); 

    });

  }).end();

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

function bundleRoutes(json, bundleNetworks) {

  /* FUNCTION bundleRoutes
   * Merges multiple routes that can be combined to a single query
   * e.g. "www.orfeus-eu.org?net=NL" and "www.orfeus-eu.org?net=NR"
   * can be combined to "www.orfeus-eu.org?net=NL,NR" at the SAME data center
   * Only do this for high-level request or risk a 413 Payload Too Large
   *
   * We always bundle stations from the same network to the same request
   */

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
