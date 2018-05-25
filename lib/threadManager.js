/* 
 * ThreadManager.js
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
const Thread = require("./thread");
const logger = require("./logger");

var HTTPThreadManager = function() {

  /* Class HTTPThreadManager
   * Asynchronously completes HTTP requests
   */

  // Set up the HTTP manager
  this.id = crypto.randomBytes(16).toString("hex");
  this.nRequests = 0;
  this.nBytes = 0;
  this._initialized = Date.now();
  this._killed = false;
  this._running = false;

}

HTTPThreadManager.prototype.shuffle = function(a) {

  /* FUNCTION HTTPThreadManager.shuffle
   * Uses Fisher-Yates shuffle to bogo requests
   */

  var j, x, i;

  for(i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }

  return a;

}

HTTPThreadManager.prototype.initialize = function(requests, emitterBinding) {

  /* FUNCTION HTTPThreadManager.initialize
   * Initializes the thread manager and opens threads
   */

  const NUMBER_OF_THREADS = 4;

  if(this._running) {
    return;
  }

  this._running = true;

  // Shuffle requests to reduce load on single node
  this.requests = this.shuffle(requests);

  // Attach an event emitter to the binding
  this.bindEmitter(emitterBinding);

  // Create new threads 
  this.threads = this.createThreads(NUMBER_OF_THREADS);

  // Open the threads
  this.threads.forEach(this.openThread.bind(this));

}

HTTPThreadManager.prototype.createThreads = function(amount) {

  /* HTTPThreadManager.createThreads
   * Creates a number of threads for parallel requests
   */

  var threads = new Array();

  for(var i = 0; i < Math.min(amount, this.requests.length); i++) {
    threads.push(new Thread(i));
  }

  return threads;

}


HTTPThreadManager.prototype.nextRequest = function() {

  /* HTTPThreadManager.nextRequest
   * Returns the next queued request
   */

  return this.requests.pop();

}

HTTPThreadManager.prototype.openThread = function(thread) {

  /* HTTPThreadManager.openThread
   * Opens a thread with a new request
   */

  // Open the thread and close the thread on completion
  thread.open(this.nextRequest(), this.closeThread.bind(this))

}

HTTPThreadManager.prototype.flushThread = function(thread) {

  /* HTTPThreadManager.flushThread
   * Flushes a thread 
   */

  if(thread.statusCode !== 200) {
    return;
  }

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
  if(this.requests.length) {
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
  this.nBytes += thread.nBytes;

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
  console.log(response.finished);

  logger.info({
    "timestamp": new Date().toISOString(),
    "id": this.id,
    "method": request.method,
    "client": this.getUserClient(request), 
    "statusCode": response.finished ? response.statusCode : 499,
    "type": "HTTP Request",
    "nBytes": this.nBytes,
    "msRequestTime": (Date.now() - this._initialized),
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
