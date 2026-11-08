import pg from "pg";
import { config } from "../config/env.js";

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
});
