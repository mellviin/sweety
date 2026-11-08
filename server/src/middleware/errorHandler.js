export function notFoundHandler(_request, _response, next) {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  response.status(status).json({
    error: {
      field: error.field ?? null,
      message: status === 500 ? "Internal server error" : error.message,
    },
  });
}
