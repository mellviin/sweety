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

function getMigrationConnectionString() {
  const migrationUrl = new URL(config.migrationDatabaseUrl);

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

export const migrationPool = new Pool({
  ...poolOptions,
  connectionString: getMigrationConnectionString(),
});
