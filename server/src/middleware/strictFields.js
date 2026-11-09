export function strictFields(location, allowedFields) {
  const allowed = new Set(allowedFields);

  return (request, _response, next) => {
    const fields = location === "body" ? request.body : request.query;
    if (fields === undefined && location === "body") {
      return next();
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return next(invalidRequestError());
    }

    const unknownField = Object.keys(fields).find((field) => !allowed.has(field));
    if (unknownField !== undefined) {
      request.validationField = unknownField;
      return next(invalidRequestError());
    }

    return next();
  };
}

function invalidRequestError() {
  const error = new Error("Please enter a valid request.");
  error.status = 400;
  error.field = null;
  return error;
}
