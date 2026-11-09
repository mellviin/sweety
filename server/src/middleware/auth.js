import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { pool } from "../db/pool.js";

export async function authenticateToken(request, response, next) {
  const authorization = request.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return sendLoginRequired(response);
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
    const userId = Number(payload.sub);
    const tokenVersion = payload.tv;

    if (
      !Number.isSafeInteger(userId)
      || userId < 1
      || !Number.isInteger(tokenVersion)
      || tokenVersion < 0
    ) {
      return sendLoginRequired(response);
    }

    const result = await pool.query(
      "SELECT token_version FROM users WHERE id = $1",
      [userId],
    );
    if (
      result.rowCount !== 1
      || result.rows[0].token_version !== tokenVersion
    ) {
      return sendLoginRequired(response);
    }

    request.user = { id: userId };
    return next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError
      || error instanceof jwt.TokenExpiredError
      || error instanceof jwt.NotBeforeError
    ) {
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
