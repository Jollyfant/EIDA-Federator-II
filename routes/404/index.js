function notFound(request, response) {

  response.writeHeader(404);
  return response.end("Route not implemented.");

}

module.exports = notFound;
