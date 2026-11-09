# Security notes

| Threat | Mitigation | File | Test |
|---|---|---|---|
| Unauthenticated or remotely reachable local database | Require explicit PostgreSQL credentials and bind the published port to `127.0.0.1`. | `docker-compose.yml` | `server/src/db/security-config.test.js` |
| API role escalating privileges or modifying schema | Separate non-superuser app and migration roles; app role receives only CRUD on app tables and limited sequence access. | `server/src/db/init/001_create_databases.sql`, `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Invalid or duplicate glucose records and non-cascading user deletion | Enforce non-null, value/slot checks, case-insensitive email and reading uniqueness, and cascading foreign key. | `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Unbounded database resource use or indefinitely slow statements | Cap pool size and set idle, connection, and statement timeouts. | `server/src/db/pool.js` | Server test suite |
| Migration operations running with application credentials | Use `MIGRATION_DATABASE_URL` for migrations and keep the app pool on `DATABASE_URL` / `TEST_DATABASE_URL`. | `server/src/db/migrate.js`, `server/src/db/pool.js` | `server/src/db/migrate.test.js`, `server/src/db/roles.test.js` |

## Known limitations

- Example passwords and connection strings are placeholders; operators must supply strong distinct values and protect real `.env` files.
- Existing containers retain their old port binding until recreated; the initialization script provisions roles only for a new data volume.
- Recreating the data volume applies changed role provisioning but permanently deletes local database data.
- PostgreSQL grants and constraints are not a substitute for production network isolation, backups, or managed secret storage.
