import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";

export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: config.authRateLimitMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (_request, response) => {
    response.status(429).json({
      error: {
        field: null,
        message: "Too many authentication requests. Please try again later.",
      },
    });
  },
});
