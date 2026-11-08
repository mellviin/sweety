import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export function authenticateToken(request, response, next) {
  const authorization = request.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return sendLoginRequired(response);
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return sendLoginRequired(response);
    }

    request.user = { id: userId };
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return sendLoginRequired(response);
    }

    return next(error);
  }
}

function sendLoginRequired(response) {
  return response.status(401).json({
    error: { field: null, message: "Please log in to continue." },
  });
}
