import { isIP } from "node:net";
import { pool } from "../db/pool.js";
import { sanitizeLogValue } from "../utils/logger.js";

const eventTypes = new Set([
  "login_failed",
  "login_success",
  "logout",
  "password_changed",
  "rate_limited",
]);

export async function recordSecurityEvent(request, eventType, userId = null) {
  if (!eventTypes.has(eventType)) {
    throw new Error("Unsupported security event type.");
  }

  const ip = typeof request.ip === "string" && isIP(request.ip)
    ? request.ip
    : null;
  const userAgent = sanitizeLogValue(request.get("user-agent") ?? "", 512);

  await pool.query(
    `INSERT INTO security_events (user_id, event_type, ip, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, eventType, ip, userAgent || null],
  );
}

export function getSafeRequestIp(request) {
  return typeof request.ip === "string" && isIP(request.ip)
    ? request.ip
    : null;
}
