import { validationResult } from "express-validator";

export function validateRequest(request, _response, next) {
  const errors = validationResult(request);

  if (errors.isEmpty()) {
    return next();
  }

  const [firstError] = errors.array();
  const error = new Error(firstError.msg);
  error.status = 400;
  error.field = firstError.path ?? null;
  return next(error);
}
