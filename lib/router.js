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

  query = createRoutingQuery(userQuery)

  http.get(query, function(response) {

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

      // Bundle requests by stations for a single data center
      var routingResponse = bundleStations(JSON.parse(Buffer.concat(chunks)));

      // If the level is default (station) or very high level: we can bundle networks in a single request
      if(userQuery.level && (userQuery.level === "network" || userQuery.level === "station")) {
        callback(null, bundleNetworks(routingResponse));
      } else {
        callback(null, routingResponse); 
      }

    });

  }).end();

}

function createQueryObject(parameters) {

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

function bundleStations(json) {

  /* FUNCTION bundleStations
   * Merges multiple routes that can be combined to a single query
   * e.g. "www.orfeus-eu.org?net=Z3&sta=A001A" and "www.orfeus-eu.org?net=Z3&sta=A002A"
   * can be combined to "www.orfeus-eu.org?net=Z3&sta=A001A,A002A" at the SAME data center
   */

  return json.map(function(datacenter) {

    var networks = new Object();

    // Sort the stations to routes
    datacenter.params.forEach(function(parameters) {

      var identifier = parameters.net + getStartYear(parameters.start);

      // Always bundle stations
      if(!networks.hasOwnProperty(identifier)) {
        networks[identifier] = createQueryObject(parameters);
        return;
      }

      networks[identifier].sta += "," + parameters.sta;

    });

    // Join the routes 
    return {
      "url": datacenter.url,
      "params": Object.values(networks)
    }

  });

}

function bundleNetworks(json) {

  /* FUNCTION bundleNetworks
   * Merges multiple routes that can be combined to a single query
   * e.g. "www.orfeus-eu.org?net=NL" and "www.orfeus-eu.org?net=NR"
   * can be combined to "www.orfeus-eu.org?net=NL,NR" at the SAME data center
   * Only do this for high-level request or risk a 413 Payload Too Large
   *
   */

  return json.map(function(datacenter) {

    var networks = new Object();

    // Sort the stations to routes
    datacenter.params.forEach(function(parameters) {

      // Bundle networks when the station is a wildcard 
      if(parameters.sta === "*") {

        if(!networks.hasOwnProperty("*")) {
          networks["*"] = createQueryObject(parameters);
          return;
        }

        networks["*"].net += "," + parameters.net;

      } else {

        var identifier = parameters.net + getStartYear(parameters.start);

        // Add others
        if(!networks.hasOwnProperty(identifier)) {
          networks[identifier] = createQueryObject(parameters);
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
