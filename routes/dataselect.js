"use strict";

const routingRequest = require("../lib/router");
const url = require("url");
const querystring = require("querystring");
const validator = require("../lib/validator");

function dataselectRoute(request, response) {

  // Validate the dataselect parameters
  try {
    validator.validateDataselectRequest(request.query);
  } catch(exception) {

    response.writeHeader(400);

    if(validator.__DEBUG__) {
      return response.end(exception.stack);
    } else {
      return response.end(exception.message);
    }

  }  

  // Get the routing information
  routingRequest(request, function(error, routes) {

    if(error) {
      return response.end("Could not get routing information.");
    }
 
    // No routes returned
    if(routes.length === 0) {
      response.writeHeader(204);
      return response.end();
    }

    var expandedRoutes = new Array();

    routes.forEach(function(datacenter) {
      datacenter.params.forEach(function(parameters) {
        expandedRoutes.push(datacenter.url + "?" + createChannelQuery(parameters));
      });
    });

    // Resolve the routes
    expandRoutes(request, response, expandedRoutes);

  });

}

function createChannelQuery(parameters) {

  /* FUNCTION createChannelQuery
   * Creates FDSN Station query for the channel expansion
   */

  return querystring.stringify({
    "network": parameters.net,
    "station": parameters.sta,
    "location": parameters.loc,
    "channel": parameters.cha,
    "start": parameters.start,
    "end": parameters.end,
    "level": "channel",
    "format": "text"
  });

}

function expandRoutes(request, response, routes) {

  /* FUNCTION expandRoutes
   * Expands routing service routes to individual channel level queries 
   */

  // Re-initialize the stream manager with new routes
  request.streamManager.initialize(routes, function(emitter) {

    // Container for all expanded requests
    var expandedStreamRequests = new Array();

    // One route has been expanded
    emitter.on("data", function(thread) {
      channelsAsArray(thread.data()).forEach(function(stream) {
        expandedStreamRequests.push(createDataselectQuery(thread.url.host, request.query, stream));
      });
    });

    // The requests have been split
    emitter.on("end", function() {
      queryDataselect(request, response, expandedStreamRequests);
    });

  });


}

function channelsAsArray(buffer) {

  /* FUNCTION channelsAsArray
   * Maps the FDSN Station channel response to stream object
   */

  return buffer.toString().split("\n").slice(1, -1).map(splitChannelParameters);

}

function splitChannelParameters(line) {

  /* FUNCTION splitChannelParameters
   * Splits line by delimited to get stream identifiers
   */

  // Line of the format:
  // net|sta|loc|cha|...|start|end|
  var streamParameters = line.split("|");

  return {
    "network": streamParameters[0],
    "station": streamParameters[1],
    "location": streamParameters[2],
    "channel": streamParameters[3],
    "start": streamParameters[15],
    "end": streamParameters[16]
  }

}

function queryDataselect(request, response, streamRequests) {

  /* FUNCTION queryDataselect
   * Queries dataselect services and flushes data to user
   */

  const FILENAME = "odc-federator-" + new Date().toISOString() + ".mseed";
  const CONTENT_TYPE = "application/vnd.fdsn.mseed";

  var __headersWritten = false;

  request.streamManager.initialize(streamRequests, function(mseedEmitter) {

    mseedEmitter.once("header", function() {
      __headersWritten = true;
      response.setHeader("Content-Type", CONTENT_TYPE);
      response.setHeader("Content-Disposition", "attachment;filename=" + FILENAME);
    });

    mseedEmitter.on("data", function(thread) {
      thread._chunks.forEach(response.write.bind(response));
    });

    mseedEmitter.on("end", function() {
      if(!__headersWritten) {
        response.writeHeader(204);
      }
      response.end();
    });

  });

}

function createDataselectQuery(host, userQuery, stream) {

  /* FUNCTION createDataselectQuery
   * Creates a query for the FDSN Dataselect service
   */

  const FDSNWS_DATASELECT_PATH = "/fdsnws/dataselect/1/query";

  // Create the new query object: use the expanded stream identifiers from FDSN Station
  // with the user start & end times
  var queryObject = {
    "network": stream.network, 
    "station": stream.station,
    "location": stream.location,
    "channel": stream.channel,
    "start": userQuery.start || userQuery.starttime,
    "end": userQuery.end || userQuery.endtime
  }

  // Add the optional quality parameter
  if(userQuery.quality) {
    queryObject.quality = userQuery.quality;
  }

  return "http://" + host + FDSNWS_DATASELECT_PATH + "?" + querystring.stringify(queryObject); 

}

module.exports = dataselectRoute;
