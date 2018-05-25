# EIDA-Federator-II
Prototype for a streaming EIDA federator using NodeJS. Currently supports `FDSNWS-Dataselect` and `FDSNWS-Station`. Only GET requests are currently supported.

# Features
* Fully federated system with no local cache
* Requests are resolved to the stream level (dataselect)
* Data requests can be run in parallel
* Streams webservice responses and runs entirely in memory
* Dataselect request splitting for large requests
* Simple request bundling to increase performance
* First mSEED record of each request is removed (It's a feature 🐛)

# Configuration

Edit the config.json file
* `HOST` - Host of the Federator server
* `PORT` - Port of the Federator server

# Running
    git clone https://github.com/Jollyfant/EIDA-Federator-II.git
    node index.js
