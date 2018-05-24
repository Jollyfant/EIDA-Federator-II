/* EIDA Federator Validator
 * Validates user input before federating requests
 *
 * Author: Mathijs Koymans, 2018
 * Copyright: ORFEUS Data Center
 * License: MIT
 *
 */

function validateDataselectRequest(query) {

  /* FUNCTION validateDataselectRequest
   * Validates the FDSN dataselect request
   */

  const ALLOWED_PARAMETERS = [
    "network", "net",
    "station", "sta",
    "location", "loc",
    "channel", "cha",
    "start", "starttime",
    "end", "endtime"
  ];

  if(!query.start) {
    throw new Error("Start time is required.");
  }

  if(!query.end) {
    throw new Error("End time is required.");
  }

  validateTimeWindow(query.start, query.end);

  Object.keys(query).forEach(function(key) {
    if(!ALLOWED_PARAMETERS.includes(key)) {
      throw new Error("The submitted parameter is unsupported: " + key);
    }
  });

}

function validateStationRequest(query) {

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

  validateTimeWindow(query.start, query.end);

  Object.keys(query).forEach(function(key) {
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

  if(query.level) {
    if(!LEVEL_ENUM.includes(query.level)) {
      throw new Error("The requested level: " + query.level + " is invalid. Expected one of: " + LEVEL_ENUM.join(", "));
    }
  }

}


function validateTimeWindow(start, end) {
  
  /* FUNCTION validateTimeWindow
   * Validates the submitted start & end times
   */

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
  
  // Force time string to be interpreted as UTC by adding "Z" if required
  // A date of the form "2000-01-01" is interpreted as UTC, 
  // but 2000-01-01T00:00:00 is interpreted as local time
  var parsedStart = new Date(asUTC(start));
  var parsedEnd = new Date(asUTC(end));
  
  if(start && isNaN(parsedStart)) {
    throw new Error("The submitted start time is invalid");
  }

  if(end && isNaN(parsedEnd)) {
    throw new Error("The submitted start time is invalid");
  } 
  
  if(start && parsedStart > Date.now()) {
    throw new Error("The submitted start time is in the future");
  }

  if(start && end && parsedStart > parsedEnd) {
    throw new Error("The submitted start time is after the submitted end time");
  }

}

module.exports.validateTimeWindow = validateTimeWindow;
module.exports.validateDataselectRequest = validateDataselectRequest;
module.exports.validateStationRequest = validateStationRequest; 
module.exports.__DEBUG__ = true;
