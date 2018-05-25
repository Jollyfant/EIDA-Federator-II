const url = require("url");
const http = require("http");
const querystring = require("querystring");

function routingRequest(request, callback) {

  /* FUNCTION routingRequest
   * Creates routing query
   */

  HTTPRequest(request.query, callback);

}

function createRoutingQuery(queryObject) {

  /* FUNCTION createRoutingQuery
   * Creates routing query
   */

  const ROUTING_URL = "http://www.orfeus-eu.org/eidaws/routing/1/query";

  var queryObject = {
    "network": queryObject.network || queryObject.net || null,
    "station": queryObject.station || queryObject.sta || null,
    "location": queryObject.location || queryObject.loc || null,
    "channel": queryObject.channel || queryObject.cha || null,
    "start": queryObject.start || queryObject.starttime || null,
    "end": queryObject.end || queryObject.endtime || null,
    "service": "station",
    "format": "json"
  }

  var routingQuery = new Array();
  var value;

  // Go over the query object and skip any null
  for(var key in queryObject) {

    value = queryObject[key];

    // Skip the extension property for routing
    if(value !== null) {
      routingQuery.push(key + "=" + value);
    }

  }

  return ROUTING_URL + "?" + routingQuery.join("&");

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

      // Determine whether we can bundle networks
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

function getStartYear(start) {

  /* FUNCTION getStartYear
   * Returns the year of an ISO date string
   */

  return new Date(start).getFullYear();

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
        var identifier = parameters.net + getStartYear(parameters.start);

        // Add others
        if(!networks.hasOwnProperty(identifier)) {
          networks[identifier] = createQueryObject(parameters);
        } else {
          networks[identifier].sta += "," + parameters.sta;
        }

      }

    });

    // Join the routes 
    return {
      "url": datacenter.url,
      "params": Object.values(networks)
    }

  });

}

module.exports = routingRequest;
