export function notFoundHandler(_request, _response, next) {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const isMalformedJson = error.type === "entity.parse.failed";
  const status = isMalformedJson
    ? 400
    : Number.isInteger(error.status)
      ? error.status
      : 500;
  const message = isMalformedJson
    ? "Invalid request body."
    : status === 500
      ? "Internal server error"
      : error.message;

  if (status >= 500) {
    console.error("Unexpected request error:", error);
  }

  const errorBody = {
    message,
  };

  if (!error.omitField) {
    errorBody.field = status >= 500 ? null : error.field ?? null;
  }

  response.status(status).json({
    error: errorBody,
  });
}
