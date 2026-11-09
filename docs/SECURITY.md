# Security notes

| Threat | Mitigation | File | Test |
|---|---|---|---|
| Unauthenticated or remotely reachable local database | Require explicit PostgreSQL credentials and bind the published port to `127.0.0.1`. | `docker-compose.yml` | `server/src/db/security-config.test.js` |
| API role escalating privileges or modifying schema | Separate non-superuser app and migration roles; app role receives only CRUD on app tables and limited sequence access. | `server/src/db/init/001_create_databases.sql`, `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Invalid or duplicate glucose records and non-cascading user deletion | Enforce non-null, value/slot checks, case-insensitive email and reading uniqueness, and cascading foreign key. | `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Unbounded database resource use or indefinitely slow statements | Cap pool size and set idle, connection, and statement timeouts. | `server/src/db/pool.js` | Server test suite |
| API runtime holding schema-altering credentials or failing on absent migration URL | Create the migration pool lazily and restrict it to migration, seed, and test flows; validate the app database URL with a clear startup error. | `server/src/db/pool.js`, `server/src/server.js`, `server/src/db/migrate.js` | `server/src/db/security-config.test.js`, `server/src/db/roles.test.js` |
| Browser injection, cross-origin requests, cached sensitive responses, malformed/oversized or polluted request bodies, and slow connections | Add strict Helmet headers, exact-origin CORS, no-store route headers, bounded JSON parsing, body validation, HPP, and HTTP server timeouts. | `server/src/app.js`, `server/src/middleware/httpHardening.js`, `server/src/middleware/errorHandler.js`, `server/src/server.js` | `server/src/app.test.js` |
| Brute-force login attempts and excessive API/read-write traffic | Apply configurable global, auth, hashed-email failed-login, and per-user reading-write limits with `Retry-After`; failed-login state is held only as a SHA-256 email hash plus IP and timestamp. | `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`, `server/src/routes/readings.js` | `server/src/app.test.js`, `server/src/routes/auth.test.js`, `server/src/routes/readings.test.js` |

## Known limitations

- Example passwords and connection strings are placeholders; operators must supply strong distinct values and protect real `.env` files.
- Existing containers retain their old port binding until recreated; the initialization script provisions roles only for a new data volume.
- Recreating the data volume applies changed role provisioning but permanently deletes local database data.
- PostgreSQL grants and constraints are not a substitute for production network isolation, backups, or managed secret storage.
- Failed-login counters are in-process and are not shared across API instances or preserved across restarts.
