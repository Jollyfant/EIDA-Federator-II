const path = require("path");
const fs = require("fs");

function dataselectWADL(request, response) {

  const WADL_PATH_DATASELECT = path.join(__dirname, "..", "..", "..", "share", "dataselect.wadl");

  response.writeHeader(200, {"Content-Type": "application/xml"});
  return fs.createReadStream(WADL_PATH_DATASELECT).pipe(response);

}

module.exports = dataselectWADL;
