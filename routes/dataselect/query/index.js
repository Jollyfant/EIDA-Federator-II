/*
 * federator/routes/dataselect
 *
 * Handler for federated dataselect route
 *
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

"use strict";

const url = require("url");
const querystring = require("querystring");

const Header = require("../../../lib/libmseedjs/header")
const routingRequest = require("../../../lib/router");
const validator = require("../../../lib/validator");

function dataselectRoute(request, response) {

  // Validate the dataselect parameters
  try {
    validator.validateDataselectRequest(request);
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
      var datacenterRoutes = new Array();
      datacenter.params.forEach(function(parameters) {
        datacenterRoutes.push(datacenter.url + "?" + createChannelQuery(request.query, parameters));
      });
      expandedRoutes.push(datacenterRoutes);
    });

    // Resolve the routes
    expandRoutes(request, response, expandedRoutes);

  });

}

function createChannelQuery(userQuery, parameters) {

  /* FUNCTION createChannelQuery
   * Creates FDSN Station query for the channel expansion
   */

  var queryObject = {
    "network": parameters.net,
    "station": parameters.sta,
    "location": parameters.loc,
    "channel": parameters.cha,
    "level": "channel",
    "format": "text"
  }

  // If a start time and end time are specified
  if(userQuery.start) {
    queryObject.start = userQuery.start;
  }
  if(userQuery.end) {
    queryObject.end = userQuery.end;
  }

  return querystring.stringify(queryObject);

}

function expandRoutes(request, response, routes) {

  /* FUNCTION expandRoutes
   * Expands routing service routes to individual channel level queries 
   */

  // Re-initialize the stream manager with new routes
  request.streamManager.initialize(routes, function(emitter) {

    // Container for all expanded requests
    var expandedStreamRequests = new Object();

    // One route has been expanded
    emitter.on("data", function(thread) {
      if(!expandedStreamRequests.hasOwnProperty(thread.url.host)) {
        expandedStreamRequests[thread.url.host] = new Array();
      }
      channelsAsArray(thread.data()).forEach(function(stream) {
        expandedStreamRequests[thread.url.host] = expandedStreamRequests[thread.url.host].concat(createDataselectQuery(thread.url.host, request.query, stream));
      });
    });

    // The requests have been split
    emitter.on("end", function() {
      queryDataselect(request, response, Object.values(expandedStreamRequests));
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
      response.write(trimFirstRecord(thread.data()));
    });

    mseedEmitter.on("end", function() {
      if(!__headersWritten) {
        response.writeHeader(204);
      }
      response.end();
    });

  });

}

function trimFirstRecord(data) {

  /* FUNCTION trimFirstRecord
   * Always trims the first mSEED record to prevent overlap
   */

  // This can fail due to bad mSEED
  try {
    return data.slice(new Header(data.slice(0, 64)).recordLength);
  } catch(exception) {
    return data;
  }

}

function createDataselectQuery(host, userQuery, stream) {

  /* FUNCTION createDataselectQuery
   * Creates a query for the FDSN Dataselect service
   */

  const FDSNWS_DATASELECT_PATH = "/fdsnws/dataselect/1/query";

  var split = splitRequests(
    userQuery.start || userQuery.starttime,
    userQuery.end || userQuery.endtime
  );

  // Create the new query object: use the expanded stream identifiers from FDSN Station
  // with the user start & end times
  return split.map(function(request) {
    var queryObject = {
      "network": stream.network, 
      "station": stream.station,
      "location": stream.location,
      "channel": stream.channel,
      "start": request.start,
      "end": request.end 
    }

    // Add the optional quality parameter
    if(userQuery.quality) {
      queryObject.quality = userQuery.quality;
    }

    return "http://" + host + FDSNWS_DATASELECT_PATH + "?" + querystring.stringify(queryObject); 

  });

}

function splitRequests(start, end) {

  // Maximum of 7 days per request
  // At 200 Hz this is ~500M samples
  const MAX_LENGTH_SECONDS = 7 * 86400 * 1000;

  // Convert to timestamp
  var start = new Date(validator.asUTC(start)).getTime();
  var end = new Date(validator.asUTC(end)).getTime();

  var requests = new Array();
  var segmentEnd;

  // Split the requests by the maximum
  while(start < end) {

    var segmentEnd = start + MAX_LENGTH_SECONDS;

    // Save the request segment
    requests.push({
      "start": new Date(start).toISOString(),
      "end": new Date(Math.min(end, segmentEnd)).toISOString()
    });

    // Next segment
    start = segmentEnd;

  }

  return requests;

}

module.exports = dataselectRoute;
