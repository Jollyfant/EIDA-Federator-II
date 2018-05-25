/* 
 * federator/lib/logger.js
 *
 * Logging class writing to logfile
 * 
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

"use strict";

const fs = require("fs");
const path = require("path");

var Logger = function() {

  /* CLASS Logger
   * Container for a logger writing to file
   */

  // Append
  const writeFlags = {"flags": "a"}
  const logPath = path.join(__dirname, "..", "log", "federator.log");

  this.logStream = fs.createWriteStream(logPath, writeFlags); 

}

Logger.prototype.write = function(level, obj) {

  /* FUNCTION Logger.write
   * Writes to logfile 
   */

  // Set the level
  obj.level = level;
  this.logStream.write(JSON.stringify(obj) + "\n");

}

Logger.prototype.error = function(obj) {

  /* FUNCTION Logger.error
   * Writes to logfile at ERROR level
   */

  this.write("ERROR", object);

}

Logger.prototype.debug = function(obj) {

  /* FUNCTION Logger.debug
   * Writes to logfile at DEBUG level
   */

  this.write("DEBUG", object);

}

Logger.prototype.info = function(object) {

  /* FUNCTION Logger.info
   * Writes to logfile at INFO level
   */

  this.write("INFO", object);

}

module.exports = new Logger();
