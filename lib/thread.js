/* 
 * Thread.js
 *
 * Container for thread class running parallel HTTP requests
 * 
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

const http = require("http");
const url = require("url");
const querystring = require("querystring");

var Thread = function(index) {

  /* CLASS Thread
   * Container for a single request thread
   */

  this.index = index;

}

Thread.prototype.size = function() {

  return this._chunks.reduce(function(a, b) {
    return a + b.length;
  }, 0);

}

Thread.prototype.data = function(type) {

  /* FUNCTION Thread.data
   * Sets up a timeout fo the HTTP request
   */

  return Buffer.concat(this._chunks);

}

Thread.prototype.setTimeout = function(ms) {

  /* FUNCTION Thread.setTimeout
   * Sets up a timeout fo the HTTP request
   */

  this._timeout = setTimeout(this.kill.bind(this), ms);

}

Thread.prototype.HTTPRequest = function() {

  /* FUNCTION Thread.HTTPRequest
   * Forces the thread to make a HTTP request
   */

  const REQUEST_TIMEOUT_MS = 10000;

  var self = this;

  this.statusCode = 504;
  this.nBytes = 0;

  // Kill the thread after a timeout
  this.setTimeout(REQUEST_TIMEOUT_MS);

  // Define the request 
  this._request = http.get(this.createRequest(), function(response) {

    // When data is received: clear the timeout
    clearTimeout(self._timeout);

    self.statusCode = response.statusCode;

    // Collect thread chunks sent over HTTP 
    response.on("data", function(chunk) {

      self._chunks.push(chunk);

      // A large data buffer can be flushed
      if(false) {
        self.flush();
      }

    });

    // The HTTP request was ended 
    response.on("end", function() {
      self.close();
    });

  });

  // Request aborted (e.g. ECONNRESET)
  this._request.on("error", function(error) {
    self.close();
  });

  // End the request and wait for response
  self._request.end();

}

Thread.prototype.flush = function() {

  /* FUNCTION Thread.flush
   * Flushes thread to manager
   */

  this._callback(this);

}

Thread.prototype.open = function(route, callback) {

  /* FUNCTION Thread.open
   * Opens a new thread to a route
   */

  const THREAD_RETRY_COUNT = 0;

  // Save callback for later use
  this._callback = callback;

  this._open = true;

  // Set defaults
  this._retryCount = THREAD_RETRY_COUNT;
  this._opened = Date.now();
  this._chunks = new Array();

  this.url = url.parse(route);
  this.query = querystring.parse(this.url.query);

  // Make the HTTP request
  this.HTTPRequest();

}

Thread.prototype.createRequest = function() {

  return {
    "hostname": this.url.host,
    "path": this.url.path,
    "headers": {
      "User-Agent": "EIDA-Federator/0.0.1"
    }
  }

}

Thread.prototype.retryRequest = function() {

  /* FUNCTION Thread.retryRequest
   * Determines whether a request should be retried
   */

  // Check the retry count
  if(this._retryCount--) {
    if(this.statusCode >= 500) {
      return true;
    }
  }

  return false;

}

Thread.prototype.close = function() {

  /* FUNCTION Thread.prototype.close
   * Closes a thread
   */

  const THREAD_RETRY_INTERVAL_MS = 1000;

  if(this._timeout) {
    clearTimeout(this._timeout);
  }

  if(this._open && this.retryRequest()) {
    return setTimeout(this.HTTPRequest.bind(this), THREAD_RETRY_INTERVAL_MS);
  }

  this._open = false;
  this.nBytes = this.size();

  // Thread completion callback
  this.flush();

}

Thread.prototype.isOpen = function() {

  /* FUNCTION Thread.isOpen
   * Returns true when thread is closed
   */

  return this._open;

}

Thread.prototype.isClosed = function() {

  /* FUNCTION Thread.isClosed
   * Returns true when thread is closed
   */

  return !this._open;

}

Thread.prototype.kill = function() {

  /* FUNCTION Thread.prototype.kill
   * Abort a thread and clean up
   */

  if(this.isOpen()) {
    this._request.abort();
  }

  this._open = false;

}

module.exports = Thread;
