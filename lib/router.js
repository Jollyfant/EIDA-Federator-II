const url = require("url");
const http = require("http");
const querystring = require("querystring");

function routingRequest(request, callback) {

  /* FUNCTION routingRequest
   * Creates routing query
   */

  HTTPRequest(createRoutingQuery(request.query), callback);

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

function HTTPRequest(query, callback) {

  /* FUNCTION HTTPRequest
   * Wrapper for HTTP requests
   */

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

      callback(null, bundleRoutes(JSON.parse(Buffer.concat(chunks))));

    });

  }).end();

}

function bundleRoutes(json) {

  /* FUNCTION bundleRoutes
   * Merges multiple routes that can be combined to a single query
   * e.g. "www.orfeus-eu.org?net=Z3&sta=A001A" and "www.orfeus-eu.org?net=Z3&sta=A002A"
   * can be combined to "www.orfeus-eu.org?net=Z3&sta=A001A,A002A" at the SAME data center
   */

  return json.map(function(datacenter) {

    var networks = new Object();

    // Sort the stations to routes
    datacenter.params.forEach(function(parameters) {

      if(!networks.hasOwnProperty(parameters.net)) {
        networks[parameters.net] = {
          "sta": parameters.sta,
          "start": parameters.start,
          "cha": parameters.cha,
          "end": parameters.end,
          "loc": parameters.loc,
          "net": parameters.net
        }
        return;
      }

      // Add new station
      networks[parameters.net].sta += "," + parameters.sta;

    });

    // Join the routes 
    return {
      "url": datacenter.url,
      "params": Object.values(networks)
    }

  });

}

module.exports = routingRequest;
