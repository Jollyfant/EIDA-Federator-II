const fs = require("fs");
const path = require("path");

var Logger = function() {

  const logPath = path.join(__dirname, "..", "log", "federator.log");

  this.level = 4;
  this.logStream = fs.createWriteStream(logPath, {"flags": "a"});

}

Logger.prototype.write = function(level, obj) {

  obj.level = level;
  this.logStream.write(JSON.stringify(obj) + "\n");

}

Logger.prototype.error = function(obj) {
  this.write("ERROR", obj);
}

Logger.prototype.debug = function(obj) {
  this.write("DEBUG", obj);
}

Logger.prototype.info = function(obj) {
  this.write("INFO", obj);
}

module.exports = new Logger();
