import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export function authenticateToken(request, response, next) {
  const authorization = request.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return response.status(401).json({
      error: { field: null, message: "Authentication required" },
    });
  }

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return response.status(401).json({
        error: { field: null, message: "Invalid or expired token" },
      });
    }

    return next(error);
  }
}
