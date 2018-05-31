/*
 * federator/test/servicetest.js
 *
 * Test suite for service
 *
 * Author: Mathijs Koymans, 2018
 * Copyright: ORFEUS Data Center
 * License: MIT
 *
 */

"use strict";

const federator = require("..");
const http = require("http");

const __HOST__ = "127.0.0.1";
const __PORT__ = 8080;

// Create a temporary federator and initialize the test suite
const server = new federator(__PORT__, __HOST__, function() {
  new testSuite().initialize();
});

const testSuite = function() {

  /* FUNCTION testSuite
   * Container for test functions
   */

  var self = this;

  this.testRouteNotImplemented = function() {
    self.request(self.getOptions(), function(statusCode, response) {
      self.__callback(statusCode === 404 && response === "Route not implemented.");
    });
  }

  this.testMethodNotImplemented = function() {
    self.request(self.getOptions({"method": "DELETE"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "Method not implemented.");
    });
  }

  this.testMissingStartTimeGET = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?end=2000-01-01"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "Start time is required.");
    });
  }

  this.testMissingEndTimeGET = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?start=2000-01-01"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "End time is required.");
    });
  }

  this.testUnsupportedKeyGET = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?key"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The submitted parameter is unsupported: key");
    });
  }

  this.testInvalidStartTime = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?end=2000-01-01&start=invalid"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The submitted start time is invalid.");
    });
  }

  this.testInvalidEndTime = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?end=invalid&start=2000-01-01"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The submitted start time is invalid.");
    });
  }

  this.testStartAfterEnd = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?end=1999-01-01&start=2000-01-01"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The submitted start time is after the submitted end time.");
    });
  }

  this.testDataselectQuality = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/query?end=2000-01-01&start=2000-01-01&quality=G"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The requested quality: G is invalid. Expected one of: D, R, Q, M, B");
    });
  }

  this.testInvalidStationFormat = function() {
    self.request(self.getOptions({"path": "/fdsnws/station/1/query?format=invalid"}), function(statusCode, response) {
      self.__callback(statusCode === 400 && response === "The requested format: invalid is invalid. Expected one of: text, xml.");
    });
  }

  this.testDataselectVersion = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/version"}), function(statusCode, response) {
      self.__callback(statusCode === 200 && response === "1.0.0");
    });
  }

  this.testStationVersion = function() {
    self.request(self.getOptions({"path": "/fdsnws/station/1/version"}), function(statusCode, response) {
      self.__callback(statusCode === 200 && response === "1.0.0");
    });
  }

  this.testStationWADL = function() {
    self.request(self.getOptions({"path": "/fdsnws/station/1/application.wadl"}), function(statusCode, response) {
      self.__callback(statusCode === 200 && response.length === 3359);
    });
  }

  this.testDataselectWADL = function() {
    self.request(self.getOptions({"path": "/fdsnws/dataselect/1/application.wadl"}), function(statusCode, response) {
      self.__callback(statusCode === 200 && response.length === 2130);
    });
  }


  /* End testing functions body
   */

  return this;

}

testSuite.prototype.getOptions = function(options) {

  /* FUNCTION testSuite.getOptions
   * Returns default or overwritten HTTP request options
   */

  // Overwrite default options
  return Object.assign({
    "headers": {
      "User-Agent": "EIDA-Federator/0.0.1-testSuite"
    },
    "host": __HOST__,
    "port": __PORT__,
    "path": "/",
    "method": "GET"
  }, options);

}

testSuite.prototype.request = function(options, HTTPCallback) {

  /* FUNCTION testSuite.request
   * Custom wrapper for HTTP requests
   */

  http.request(options, function(response) {

    var chunks = new Array();

    response.on("data", function(chunk) {
      chunks.push(chunk);
    });

    response.on("end", function() {
      HTTPCallback(response.statusCode, Buffer.concat(chunks).toString());
    });

  }).end();

}

testSuite.prototype.nextTest = function() {

  /* FUNCTION testSuite.nexTest
   * Returns the next queued test
   */

  return this.testNames.pop();

}

testSuite.prototype.initialize = function() {

  /* FUNCTION testSuite.initialize
   * Initializes the test suite
   */

  // Get all tests
  this.testNames = Object.getOwnPropertyNames(this);

  // Reset statistics
  this.__statistics = {
    "success": 0,
    "failure": 0
  }

  this.log("Test suite has been initialized with " + this.testNames.length + " test(s).");

  this.runSingleTest();

}

testSuite.prototype.log = function(text) {

  /* FUNCTION testSuite.log
   * Writes formatted string to stdout
   */

  console.log(
    new Date().toISOString() + " " + text
  );

}

testSuite.prototype.record = function(result) {

  /* FUNCTION testSuite.record
   * Aggregates result in statistics
   */

  result ? this.__statistics.success++ : this.__statistics.failure++;

}

testSuite.prototype.__callback = function(result) {

  /* FUNCTION testSuite.__callback
   * Aggregates result in statistics
   */

  this.log("Test " + (result ? "succeeded" : "failed") + " in " + (Date.now() - this.__testInitialized) + "ms");

  this.record(result);

  // Continue with next queued test
  if(this.testNames.length) {
    return this.runSingleTest();
  }

  this.log("All tests run: " + JSON.stringify(this.__statistics));

  // Gracefully close the federator
  server.close();

}

testSuite.prototype.runSingleTest = function() {

  /* FUNCTION testSuite.runSingleTest
   * Runs a single test from the collection
   */

  var func = this.nextTest();

  this.log("Calling test function: " + func);

  this.__testInitialized = Date.now();

  this[func]();

}
