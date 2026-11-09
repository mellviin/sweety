import { logger } from "../utils/logger.js";

export function notFoundHandler(_request, _response, next) {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
}

export function errorHandler(error, request, response, _next) {
  const isMalformedJson = error.type === "entity.parse.failed";
  const isOversizedBody = error.type === "entity.too.large";
  const status = isMalformedJson
    ? 400
    : isOversizedBody
      ? 413
    : Number.isInteger(error.status)
      ? error.status
      : 500;
  const message = isMalformedJson
    ? "Invalid request body."
    : isOversizedBody
      ? "Request body too large."
    : status === 500
      ? "Internal server error"
      : error.message;

  if (status === 400) {
    logger.warn("validation_rejected", {
      request_id: request.requestId,
      field: request.validationField ?? error.field ?? null,
    });
  }

  if (status >= 500) {
    logger.error("request_failed", {
      request_id: request.requestId,
      status,
    });
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
