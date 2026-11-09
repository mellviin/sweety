export function strictFields(location, allowedFields) {
  const allowed = new Set(allowedFields);

  return (request, _response, next) => {
    const fields = request[location];
    if (fields === undefined && location === "body") {
      return next();
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return next(invalidRequestError());
    }

    if (Object.keys(fields).some((field) => !allowed.has(field))) {
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
