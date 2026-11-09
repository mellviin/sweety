import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = dirname(fileURLToPath(import.meta.url));

function parseTrustProxy(value) {
  if (!value || value.toLowerCase() === "false") {
    return false;
  }
  if (value.toLowerCase() === "true") {
    return true;
  }

  const hopCount = Number(value);
  return Number.isInteger(hopCount) && hopCount >= 0
    ? hopCount
    : value.split(",").map((entry) => entry.trim());
}

dotenv.config({
  path: [
    resolve(configDirectory, "../../.env"),
    resolve(configDirectory, "../../../.env"),
  ],
});

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  testDatabaseUrl: process.env.TEST_DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  port: Number(process.env.PORT ?? 3000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  authRateLimitWindowMs: Number(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000,
  ),
};

export function assertJwtSecret() {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET must be set before the API can start.");
  }
}

export function assertDatabaseUrl() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL must be set before the API can start.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(config.databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
    || !databaseUrl.hostname
    || !databaseUrl.pathname.slice(1)
  ) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
}
