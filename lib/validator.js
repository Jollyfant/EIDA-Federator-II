/*
 * federator/lib/validator.js
 *
 * Validates user input before federating requests
 *
 * Author: Mathijs Koymans, 2018
 * Copyright: ORFEUS Data Center
 * License: MIT
 *
 */

function validateDataselectRequest(request) {

  /* FUNCTION validateDataselectRequest
   * Validates the FDSN dataselect request
   */

  const ALLOWED_PARAMETERS = [
    "network", "net",
    "station", "sta",
    "location", "loc",
    "channel", "cha",
    "start", "starttime",
    "end", "endtime",
    "quality"
  ];

  // Required for GET/POST requests
  if(request.method === "GET") {

    if(!request.query.start) {
      throw new Error("Start time is required.");
    }

    if(!request.query.end) {
      throw new Error("End time is required.");
    }

    validateTimeWindow(request.query.start, request.query.end);

  }

  if(request.method === "POST") {

    request.segments.map(splitSegment).forEach(validateSegment);

  }

  const QUALITY_ENUM = ["D", "R", "Q", "M", "B"];

  if(request.query.quality) {
    if(!QUALITY_ENUM.includes(request.query.quality)) {
      throw new Error("The requested quality: " + request.query.quality + " is invalid. Expected one of: " + QUALITY_ENUM.join(", "));
    } 
  }

  Object.keys(request.query).forEach(function(key) {
    if(!ALLOWED_PARAMETERS.includes(key)) {
      throw new Error("The submitted parameter is unsupported: " + key);
    }
  });

}

function validateSegment(segment) {
 
  validateTimeWindow(segment.start, segment.end);

}

function splitSegment(segment) {

  /* FUNCTION splitSegment
   * Splits the segment to object 
   */

  var split = segment.split(" ");

  if(split.length !== 6) {
    throw new Error("Invalid segment submitted.");
  }

  return {
    "network": split[0],
    "station": split[1],
    "location": split[2],
    "channel": split[3],
    "start": split[4],
    "end": split[5]
  }

}

function validateStationRequest(request) {

  /* FUNCTION validateRequest
   * Validates federated FDSNWS Station query
   */

  const ALLOWED_PARAMETERS = [
    "network", "net",
    "station", "sta",
    "location", "loc",
    "channel", "cha",
    "start", "starttime",
    "end", "endtime",
    "minlatitude",
    "maxlatitude",
    "minlongitude",
    "maxlongitude",
    "level"
  ];

  if(request.method === "GET") {
    validateTimeWindow(request.query.start, request.query.end);
  }

  if(request.method === "POST") {
    request.segments.map(splitSegment).forEach(validateSegment);
  }

  Object.keys(request.query).forEach(function(key) {
    if(!ALLOWED_PARAMETERS.includes(key)) {
      throw new Error("The submitted parameter is unsupported: " + key);
    }
  });

  const LEVEL_ENUM = [
    "network",
    "station",
    "location",
    "channel"
  ];

  if(request.query.level) {
    if(!LEVEL_ENUM.includes(request.query.level)) {
      throw new Error("The requested level: " + request.query.level + " is invalid. Expected one of: " + LEVEL_ENUM.join(", "));
    }
  }

}

function asUTC(time) {

  /* FUNCTION asUTC
   * Forces submitted time string to UTC
   */

  if(!time) {
    return null;
  }

  if(!time.includes("T") || time.endsWith("Z")) {
    return time;
  }

  return time + "Z";

}

function validateTimeWindow(start, end) {
  
  /* FUNCTION validateTimeWindow
   * Validates the submitted start & end times
   */

  // Force time string to be interpreted as UTC by adding "Z" if required
  // A date of the form "2000-01-01" is interpreted as UTC, 
  // but 2000-01-01T00:00:00 is interpreted as local time
  var parsedStart = new Date(asUTC(start));
  var parsedEnd = new Date(asUTC(end));
  
  if(start && isNaN(parsedStart)) {
    throw new Error("The submitted start time is invalid.");
  }

  if(end && isNaN(parsedEnd)) {
    throw new Error("The submitted start time is invalid.");
  } 
  
  if(start && parsedStart > Date.now()) {
    throw new Error("The submitted start time is in the future.");
  }

  if(start && end && parsedStart > parsedEnd) {
    throw new Error("The submitted start time is after the submitted end time.");
  }

}

module.exports.validateTimeWindow = validateTimeWindow;
module.exports.validateDataselectRequest = validateDataselectRequest;
module.exports.validateStationRequest = validateStationRequest; 
module.exports.asUTC = asUTC;
module.exports.__DEBUG__ = false;
