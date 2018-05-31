const path = require("path");
const fs = require("fs");

function stationWADL(request, response) {

  const WADL_PATH_STATION = path.join(__dirname, "..", "..", "..", "share", "station.wadl");

  response.writeHeader(200, {"Content-Type": "application/xml"});
  return fs.createReadStream(WADL_PATH_STATION).pipe(response);

}

module.exports = stationWADL;
