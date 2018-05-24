/* NodeJS EIDA Federator Prototype
 *
 * Federates dataselect and station requests across EIDA
 * THIS IS AN EARLY PROTOTYPE AND EXPERIMENT
 *
 * Author: Mathijs Koymans, 2018
 * Copyright: ORFEUS Data Center
 * License: MIT
 *
 */

"use strict";

const http = require("http");
const Federator = require("./lib/federator");

const FEDERATOR_HOST = "127.0.0.1";
const FEDERATOR_PORT = 8080;

module.exports = function(port, host, listenCallback) {

  const FEDERATOR_TIMEOUT_MS = 0;

  // Create the federator server
  const federator = http.createServer(Federator);

  // Open for incoming connections
  federator.listen(port, host, listenCallback);
  federator.timeout = FEDERATOR_TIMEOUT_MS;

}

if(require.main === module) {

  new module.exports(FEDERATOR_PORT, FEDERATOR_HOST, function() {
    console.log("EIDA Federator has been initialized.");
  });

}
