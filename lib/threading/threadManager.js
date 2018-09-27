/* 
 * federator/lib/threadManager.js
 *
 * Manager class for running parallel HTTP requests
 * 
 * Author: Mathijs Koymans
 * Copyright: ORFEUS Data Center, 2018
 * License: MIT
 *
 */

"use strict";

const events = require("events");
const crypto = require("crypto");
const Thread = require("./lib/threading/thread");
const logger = require("./lib/logger");
const url = require("url");

var HTTPThreadManager = function() {

  /* Class HTTPThreadManager
   * Asynchronously completes HTTP requests
   */

  // Set up the HTTP manager
  this.id = crypto.randomBytes(16).toString("hex");
  this.nRequests = 0;
  this._initialized = Date.now();

  // Keep state
  this._killed = false;
  this._running = false;

}

HTTPThreadManager.prototype.initialize = function(requests, emitterBinding) {

  /* Function HTTPThreadManager.initialize
   * Initializes the thread manager and opens threads
   */

  const NUMBER_OF_THREADS = 10;

  // Cannot initialize if already running
  if(this._running) {
    return;
  }

  this._running = true;

  // Shuffle requests to reduce load on single node
  this.requests = requests; 

  // Attach an event emitter to the binding
  this.bindEmitter(emitterBinding);

  // Create new threads 
  this.threads = this.createThreads(NUMBER_OF_THREADS);

  // Open the threads
  this.threads.forEach(this.openThread.bind(this));

}

HTTPThreadManager.prototype.createThreads = function(threadsPerDatacenter) {

  /* Function HTTPThreadManager.createThreads
   * Creates a number of threads for parallel requests
   */

  var threads = new Array();

  // Open at least one thread per datacenter
  // The index passed to the constructor is the arbitrary datacenter index
  this.requests.forEach(function(x, i) { 
    for(var j = 0; j < Math.min(x.length, threadsPerDatacenter); j++) {
      threads.push(new Thread(i));
    }
  });

  return threads;

}


HTTPThreadManager.prototype.nextRequest = function(index) {

  /* HTTPThreadManager.nextRequest
   * Returns the next queued request
   */

  return this.requests[index].pop();

}

HTTPThreadManager.prototype.openThread = function(thread) {

  /* HTTPThreadManager.openThread
   * Opens a thread with a new request
   */

  // Open the thread and close the thread on completion
  thread.open(this.nextRequest(thread.index), this.closeThread.bind(this))

}

HTTPThreadManager.prototype.flushThread = function(thread) {

  /* HTTPThreadManager.flushThread
   * Flushes a thread 
   */

  if(thread.statusCode !== 200) {
    return;
  }

  // Write header and data
  this.emitter.emit("header");
  this.emitter.emit("data", thread);

}

HTTPThreadManager.prototype.closeThread = function(thread) {

  /* HTTPThreadManager.closeThread
   * Executed when a thread is closed
   */

  if(this._killed) {
    return;
  }

  this.logThread(thread);
  this.flushThread(thread);

  // More routes to collect
  if(this.requests[thread.index].length) {
    return this.openThread(thread);
  }

  // If all threads have been exhausted the federation is completed
  if(this.isExhausted()) {
    this._running = false;
    this.emitter.emit("end");
  }

}

HTTPThreadManager.prototype.bindEmitter = function(binding) {

  /* HTTPThreadManager.bindEmitter
   * Binds an event emitter callback to the emitter
   */

  // Create a new event emitter
  this.emitter = new events.EventEmitter();

  // Bind the emitter
  binding(this.emitter);

}

HTTPThreadManager.prototype.isExhausted = function() {
 
  /* HTTPThreadManager.isExhausted
   * Returns whether the thread manager is exhausted
   * and has no additional routes to collect
   */

  // Confirm that every thread is closed
  return this.threads.every(function(thread) {
    return thread.isClosed();
  });

}

HTTPThreadManager.prototype.kill = function(request, response) {

  /* HTTPThreadManager.kill
   * Aborts the thread manager and kills all running threads
   */

  this._killed = true;

  if(this._running) {
    this.threads.forEach(function(thread) {
      thread.kill();
    });
  }

}

HTTPThreadManager.prototype.finish = function(request, response) {

  /* HTTPThreadManager.logThread
   * Fired when the connection was finished
   */

  this.logHTTPRequest(request, response);

}

HTTPThreadManager.prototype.logThread = function(thread) {

  /* HTTPThreadManager.logThread
   * Logs a summary of the thread 
   */

  this.nRequests++;

  logger.info({
    "timestamp": new Date().toISOString(),
    "id": this.id,
    "type": "Service Request",
    "request": {
      "query": thread.query, 
      "host": thread.url.host,
      "path": thread.url.pathname
    },
    "statusCode": thread.statusCode,
    "nBytes": thread.nBytes,
    "msRequestTime": (Date.now() - thread._opened)
  });

}

HTTPThreadManager.prototype.logHTTPRequest = function(request, response) {

  /* HTTPThreadManager.logHTTPRequest
   * Logs a summary of the HTTP request
   */

  var qUrl = url.parse(request.url);

  logger.info({
    "timestamp": new Date().toISOString(),
    "id": this.id,
    "method": request.method,
    "path": qUrl.pathname,
    "query": qUrl.query,
    "client": this.getUserClient(request), 
    "statusCode": response.finished ? response.statusCode : 499,
    "type": "HTTP Request",
    "nBytes": response.bytesWritten,
    "msRequestTime": (Date.now() - this._initialized),
    "agent": request.headers["user-agent"] || null,
    "nRequests": this.nRequests
  });

}

HTTPThreadManager.prototype.getUserClient = function(request) {

  /* HTTPThreadManager.kill
   * Aborts the thread manager and kills all running threads
   */

  return request.headers["x-forwarded-for"] || request.connection.remoteAddress;

}

module.exports = HTTPThreadManager;
