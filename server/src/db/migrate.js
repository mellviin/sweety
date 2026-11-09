import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getMigrationPool } from "./pool.js";
import { logger } from "../utils/logger.js";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function runMigrations(database = getMigrationPool()) {
  const client = await database.connect();

  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS sweety_meta AUTHORIZATION sweety_migrate
    `);
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('sweety_meta.schema_migrations') IS NULL
          AND to_regclass('public.schema_migrations') IS NOT NULL THEN
          ALTER TABLE public.schema_migrations SET SCHEMA sweety_meta;
        END IF;
      END
      $$
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sweety_meta.schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "REVOKE ALL ON sweety_meta.schema_migrations FROM sweety_app",
    );

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT migration_name FROM sweety_meta.schema_migrations WHERE migration_name = $1",
        [file],
      );

      if (rowCount > 0) {
        continue;
      }

      // Migration names come only from the fixed migrations directory listing.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- the joined path is constrained to that directory.
      const migration = await readFile(join(migrationsDirectory, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(migration);
        await client.query(
          "INSERT INTO sweety_meta.schema_migrations (migration_name) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        logger.info("migration_applied");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let migrationPool;
  try {
    migrationPool = getMigrationPool();
    await runMigrations(migrationPool);
  } catch {
    logger.error("database_migration_failed");
    process.exitCode = 1;
  } finally {
    if (migrationPool) {
      await migrationPool.end();
    }
  }
}
