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

// Globally patch the require function
require("./require");

const { createServer } = require("http");
const { server } = require("./lib/federator");

module.exports = function(port, host, listenCallback) {

  // Disable timeouts
  const FEDERATOR_TIMEOUT_MS = 0;

  // Create the federator server
  const federator = createServer(server);

  // Replace with ENV variables
  port = process.env.SERVICE_PORT || port;
  host = process.env.SERVICE_HOST || host;

  federator.timeout = FEDERATOR_TIMEOUT_MS;

  // Open for incoming connections
  federator.listen(port, host, listenCallback);

}

if(require.main === module) {

  const CONFIG = require("./config");

  new module.exports(CONFIG.PORT, CONFIG.HOST, function() {
    console.log("EIDA Federator has been initialized.");
  });

}
