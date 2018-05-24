const routingRequest = require("../lib/router");
const querystring = require("querystring");
const validator = require("../lib/validator");

function stationRequest(request, response) {

  // Validate the dataselect parameters
  try {
    validator.validateStationRequest(request.query);
  } catch(exception) {

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

    if(routes.length === 0) {
      response.writeHeader(204);
      return response.end();
    }

    var expandedRoutes = new Array();

    routes.forEach(function(datacenter) {
      datacenter.params.forEach(function(parameters) {
        expandedRoutes.push(datacenter.url + "?" + createStationQuery(request.query, parameters));
      });
    });

    // Resolve the routes
    stationResolve(request, response, expandedRoutes);

  });

}

function createStationQuery(userQuery, parameters) {

  /* FUNCTION createStationQuery
   * Extends the route with extra FDSNWS-Station parameter
   */

  var queryObject = {
    "network": parameters.net,
    "station": parameters.sta,
    "location": parameters.loc,
    "channel": parameters.cha
  }

  if(userQuery.start || userQuery.starttime) {
    queryObject.start = userQuery.start || userQuery.starttime;
  }

  if(userQuery.end || userQuery.end) {
    queryObject.end = userQuery.end || userQuery.end;
  }

  // Level parameter
  if(userQuery.level) {
    queryObject.level = userQuery.level;
  }

  // Geographic Constraints
  // Area-Rectangle
  if(userQuery.minlatitude) {
    queryObject.minlatitude = userQuery.minlatitude;
  }
  if(userQuery.maxlatitude) {
    queryObject.maxlatitude = userQuery.maxlatitude;
  }
  if(userQuery.minlongitude) {
    queryObject.minlongitude = userQuery.minlongitude;
  }
  if(userQuery.maxlongitude) {
    queryObject.maxlongitude = userQuery.maxlongitude;
  }

  // Area-Circle
  if(userQuery.latitude) {
    queryObject.latitude = userQuery.latitude;
  }
  if(userQuery.longitude) {
    queryObject.longitude = userQuery.longitude;
  }
  if(userQuery.minradius) {
    queryObject.minradius = userQuery.minradius;
  }
  if(userQuery.maxradius) {
    queryObject.maxradius = userQuery.maxradius;
  }

  if(userQuery.startbefore) {
    queryObject.startbefore = userQuery.startbefore;
  }
  if(userQuery.startafter) {
    queryObject.startafter = userQuery.startafter;
  }
  if(userQuery.endbefore) {
    queryObject.endbefore = userQuery.endbefore;
  }
  if(userQuery.endafter) {
    queryObject.endafter = userQuery.endafter;
  }

  return querystring.stringify(queryObject);

}

function writeFDSNStationXMLHeaders() {

  /* function writeFDSNStationXMLHeaders
   * Writes FDSNStationXML headers 
   */

  const SOURCE = "EIDA Federator";
  const SENDER = "ORFEUS Data Center";

  var namespaces = [
    "<FDSNStationXML ",
    "xmlns=\"http://www.fdsn.org/xml/station/1\"",
    "xmlns:ingv=\"https://raw.githubusercontent.com/FDSN/StationXML/master/fdsn-station.xsd\"",
    "schemaVersion=\"1.0\">"
  ].join(" ");

  // The NodeJS Federator StationXML header
  return [
    namespaces,
    "<Source>" + SOURCE + "</Source>",
    "<Sender>" + SENDER + "</Sender>",
    "<Created>" + new Date().toISOString() + "</Created>"
  ].join("");

}

function stationResolve(request, response, streamRequests) {

  /* FUNCTION stationResolve
   * Resolve parallel requests
   */

  const CONTENT_TYPE = "application/xml";

  var __headersWritten = false;

  request.streamManager.initialize(streamRequests, function(streamEmitter) {

    // Write the headers
    streamEmitter.once("header", function() {
      __headersWritten = true;
      response.setHeader("Content-Type", CONTENT_TYPE);
      response.write(writeFDSNStationXMLHeaders());
    });

    // StationXML is received
    streamEmitter.on("data", function(thread) {
      response.write(getNetworkSlice(thread.data()));
    });

    streamEmitter.on("end", function() {

      // If headers are written
      if(__headersWritten) {
        return response.end("</FDSNStationXML>");
      }

      // Empty response
      response.writeHeader(204);
      response.end();

    });

  });

}

function getNetworkSlice(stationXML) {

  /* FUNCTION getNetworkSlice
   * Slices headers from the received StationXML 
   */

  var startIndex = stationXML.indexOf("<Network");
  var endIndex = stationXML.lastIndexOf("</Network") + 10;

  return stationXML.slice(startIndex, endIndex);

}

module.exports = stationRequest;
