import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = dirname(fileURLToPath(import.meta.url));

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
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
};

export function assertJwtSecret() {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET must be set before the API can start.");
  }
}
