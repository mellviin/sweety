import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContext(request, response, next) {
  const suppliedId = request.get("X-Request-Id");
  const requestId = suppliedId && requestIdPattern.test(suppliedId)
    ? suppliedId
    : randomUUID();

  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  response.once("finish", () => {
    logger.info("http_request", {
      request_id: requestId,
      method: request.method,
      status: response.statusCode,
    });
  });

  next();
}
