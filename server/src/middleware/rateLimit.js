import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";
import { recordSecurityEvent, getSafeRequestIp } from "../services/securityEventService.js";
import { logger, maskEmail } from "../utils/logger.js";

const failedLoginAttempts = new Map();
const defaultRateLimitMessage = "Too many requests. Please try again later.";
const maxTrackedLoginEmails = 10_000;

function isDisabledInTest() {
  return process.env.NODE_ENV === "test" && !config.rateLimitsEnabled;
}

async function sendRateLimitResponse(request, response, windowMs, limiter) {
  const resetTime = request.rateLimit?.resetTime?.getTime();
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
    : Math.max(1, Math.ceil(windowMs / 1000));

  await recordLimitEvent(request, limiter);
  response.setHeader("Retry-After", String(retryAfterSeconds));
  response.status(429).json({
    error: {
      field: null,
      message: defaultRateLimitMessage,
    },
  });
}

async function recordLimitEvent(request, limiter) {
  try {
    await recordSecurityEvent(request, "rate_limited");
  } catch {
    logger.error("security_event_write_failed", {
      request_id: request.requestId,
      event_type: "rate_limited",
    });
  }

  logger.warn("request_rate_limited", {
    request_id: request.requestId,
    limiter,
    ip: getSafeRequestIp(request),
    email: limiter === "login_lockout"
      ? maskEmail(request.body?.email)
      : undefined,
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
    "global",
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
    "auth",
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
    "reading_write",
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
    return recordLimitEvent(request, "login_lockout").then(() => {
      logger.warn("auth_login_lockout", {
        request_id: request.requestId,
        email: maskEmail(request.body.email),
        ip: getSafeRequestIp(request),
      });
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({
        error: {
          field: null,
          message: defaultRateLimitMessage,
        },
      });
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
