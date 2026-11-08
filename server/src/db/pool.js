import pg from "pg";
import { config } from "../config/env.js";

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: process.env.NODE_ENV === "test"
    ? config.testDatabaseUrl
    : config.databaseUrl,
});
