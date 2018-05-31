function stationVersion(request, response) {

  const __VERSION__ = "1.0.0";

  response.write(__VERSION__);
  response.end();

}

module.exports = stationVersion;
