import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";

const failedLoginAttempts = new Map();
const defaultRateLimitMessage = "Too many requests. Please try again later.";
const maxTrackedLoginEmails = 10_000;

function isDisabledInTest() {
  return process.env.NODE_ENV === "test" && !config.rateLimitsEnabled;
}

function sendRateLimitResponse(request, response, windowMs) {
  const resetTime = request.rateLimit?.resetTime?.getTime();
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
    : Math.max(1, Math.ceil(windowMs / 1000));

  response.setHeader("Retry-After", String(retryAfterSeconds));
  response.status(429).json({
    error: {
      field: null,
      message: defaultRateLimitMessage,
    },
  });
}

export const globalRateLimiter = rateLimit({
  windowMs: config.globalRateLimitWindowMs,
  limit: () => config.globalRateLimitMax,
  standardHeaders: false,
  legacyHeaders: false,
  skip: isDisabledInTest,
  handler: (request, response) => sendRateLimitResponse(
    request,
    response,
    config.globalRateLimitWindowMs,
  ),
});

export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: () => config.authRateLimitMax,
  standardHeaders: false,
  legacyHeaders: false,
  skip: isDisabledInTest,
  handler: (request, response) => sendRateLimitResponse(
    request,
    response,
    config.authRateLimitWindowMs,
  ),
});

export const readingWriteRateLimiter = rateLimit({
  windowMs: config.readingWriteRateLimitWindowMs,
  limit: () => config.readingWriteRateLimitMax,
  keyGenerator: (request) => String(request.user.id),
  standardHeaders: false,
  legacyHeaders: false,
  skip: isDisabledInTest,
  handler: (request, response) => sendRateLimitResponse(
    request,
    response,
    config.readingWriteRateLimitWindowMs,
  ),
});

export function failedLoginRateLimiter(request, response, next) {
  if (isDisabledInTest()) {
    return next();
  }

  const emailHash = createHash("sha256")
    .update(request.body.email.trim().toLowerCase())
    .digest("hex");
  const now = Date.now();
  const windowMs = config.loginFailureRateLimitWindowMs;
  pruneFailedLoginAttempts(now, windowMs);
  const recentAttempts = (failedLoginAttempts.get(emailHash) ?? [])
    .filter((attempt) => now - attempt.createdAt < windowMs);

  if (recentAttempts.length >= config.loginFailureRateLimitMax) {
    failedLoginAttempts.set(emailHash, recentAttempts);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recentAttempts[0].createdAt + windowMs - now) / 1000),
    );
    response.setHeader("Retry-After", String(retryAfterSeconds));
    return response.status(429).json({
      error: {
        field: null,
        message: defaultRateLimitMessage,
      },
    });
  }

  failedLoginAttempts.set(emailHash, recentAttempts);
  response.once("finish", () => {
    if (response.statusCode === 401) {
      const attempts = failedLoginAttempts.get(emailHash) ?? [];
      attempts.push({
        ip: request.ip,
        createdAt: Date.now(),
      });
      failedLoginAttempts.set(emailHash, attempts);
      if (failedLoginAttempts.size > maxTrackedLoginEmails) {
        pruneFailedLoginAttempts(Date.now(), windowMs);
      }
    } else if (response.statusCode >= 200 && response.statusCode < 300) {
      failedLoginAttempts.delete(emailHash);
    }
  });

  return next();
}

function pruneFailedLoginAttempts(now, windowMs) {
  for (const [emailHash, attempts] of failedLoginAttempts) {
    const recentAttempts = attempts.filter(
      (attempt) => now - attempt.createdAt < windowMs,
    );
    if (recentAttempts.length === 0) {
      failedLoginAttempts.delete(emailHash);
    } else {
      failedLoginAttempts.set(emailHash, recentAttempts);
    }
  }

  while (failedLoginAttempts.size > maxTrackedLoginEmails) {
    const oldestEmailHash = failedLoginAttempts.keys().next().value;
    failedLoginAttempts.delete(oldestEmailHash);
  }
}
