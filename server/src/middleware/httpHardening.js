const forbiddenPropertyNames = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function noStore(_request, response, next) {
  response.setHeader("Cache-Control", "no-store");
  next();
}

export function requireJsonContentType(request, _response, next) {
  const hasBody = request.get("content-length") !== undefined
    || request.get("transfer-encoding") !== undefined;
  const acceptsJson = request.is([
    "application/json",
    "application/*+json",
  ]);

  if (
    ["POST", "PUT", "PATCH"].includes(request.method)
    && hasBody
    && !acceptsJson
  ) {
    const error = new Error("Content-Type must be application/json.");
    error.status = 415;
    return next(error);
  }

  return next();
}

export function rejectPrototypeKeys(request, _response, next) {
  if (containsForbiddenProperty(request.body)) {
    const error = new Error("Invalid request body.");
    error.status = 400;
    return next(error);
  }

  return next();
}

function containsForbiddenProperty(value) {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenProperty);
  }

  if (value === null || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, child]) =>
    forbiddenPropertyNames.has(key) || containsForbiddenProperty(child));
}
