import pg from "pg";
import { config } from "../config/env.js";

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);

const poolOptions = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
};

let migrationPool;

function getMigrationConnectionString() {
  const configuredUrl = process.env.MIGRATION_DATABASE_URL;
  if (!configuredUrl) {
    throw new Error(
      "MIGRATION_DATABASE_URL must be set to run database migrations.",
    );
  }

  const migrationUrl = new URL(configuredUrl);

  if (process.env.NODE_ENV === "test") {
    const testUrl = new URL(config.testDatabaseUrl);
    migrationUrl.hostname = testUrl.hostname;
    migrationUrl.port = testUrl.port;
    migrationUrl.pathname = testUrl.pathname;
    migrationUrl.search = testUrl.search;
  }

  return migrationUrl.toString();
}

export const pool = new Pool({
  ...poolOptions,
  connectionString: process.env.NODE_ENV === "test"
    ? config.testDatabaseUrl
    : config.databaseUrl,
});

export function getMigrationPool() {
  if (!migrationPool) {
    migrationPool = new Pool({
      ...poolOptions,
      connectionString: getMigrationConnectionString(),
    });
  }

  return migrationPool;
}
