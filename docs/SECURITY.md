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
| Weak/reused passwords, login enumeration, forged/stale tokens, and persistent compromised sessions | Enforce the local common-password policy, compare a dummy bcrypt hash for unknown users, require HS256 plus issuer/audience/expiry, and invalidate tokens with a database token version on logout/password change. | `server/src/services/authService.js`, `server/src/services/passwordPolicy.js`, `server/src/middleware/auth.js`, `server/src/db/migrations/003_auth_hardening.sql` | `server/src/routes/auth.test.js` |
| Cross-user reading access, mass assignment, malformed inputs, and SQL injection | Scope reading/report queries to the verified user ID, reject unknown request fields (including `user_id`/`userId`), validate scalar IDs/dates/pagination, and use static SQL with parameterized values. | `server/src/services/readingService.js`, `server/src/services/reportService.js`, `server/src/middleware/strictFields.js`, `server/src/db/seed.js` | `server/src/routes/readings.test.js`, `server/src/routes/reports.test.js`, `server/src/routes/auth.test.js`, `server/src/security/sqlQuerySafety.test.js` |
| Persistent exposure of bearer tokens and client-side script injection | Keep the Authorization-header model, store the token in `sessionStorage`, clear it on logout and every 401, and disallow dangerous React HTML insertion with ESLint and CSP. | `client/src/api/client.js`, `client/src/context/AuthContext.jsx`, `client/eslint.config.js`, `client/index.html`, `client/vite.config.js` | `client/src/api/client.test.js`, `client/src/App.test.jsx` |
| Sensitive data leakage or forged log lines, and lack of security-event auditability | Emit JSON logs from a strict field allow-list, sanitize control characters and mask emails, attach a validated request ID, and persist limited auth/rate-limit events in an app-role INSERT/SELECT-only table. | `server/src/utils/logger.js`, `server/src/middleware/requestContext.js`, `server/src/services/securityEventService.js`, `server/src/db/migrations/004_security_events.sql` | `server/src/app.test.js`, `server/src/routes/auth.test.js`, `server/src/db/roles.test.js` |

### Browser security headers

The production Vite build inserts a CSP meta fallback; development removes it so Vite HMR works. Meta policies cannot enforce `frame-ancestors`, so configure this CSP as a real response header at the production web server/CDN. With a same-origin `/api` reverse proxy, an example Nginx header is:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests" always;
```

If the API is served from a separate origin, add only that exact HTTPS origin to `connect-src` in both the response header and the CSP meta fallback. Keep `frame-ancestors` in the response header; browsers ignore it in meta policies.

## Known limitations

- Example passwords and connection strings are placeholders; operators must supply strong distinct values and protect real `.env` files.
- Existing containers retain their old port binding until recreated; the initialization script provisions roles only for a new data volume.
- Recreating the data volume applies changed role provisioning but permanently deletes local database data.
- PostgreSQL grants and constraints are not a substitute for production network isolation, backups, or managed secret storage.
- Failed-login counters are in-process and are not shared across API instances or preserved across restarts.
- Registration deliberately retains its assignment-required 409 duplicate-email response, which reveals whether an email is registered; mitigating this enumeration channel would require changing that agreed API behavior.
- Request schemas reject unknown body and query fields with 400; clients must not send extra fields such as `user_id` or `userId`.
- The bearer token remains accessible to same-origin JavaScript in `sessionStorage`; session storage reduces persistence but does not prevent theft by a successful XSS.
- Security-event records include IP addresses and user-agent strings; establish and enforce an operational retention period appropriate to the deployment.

## What I'd do next

- Consider moving bearer tokens to `HttpOnly`, `Secure`, `SameSite` cookies. This is stronger against JavaScript token theft, but requires coordinated server/client cookie handling, CSRF protection (for example a CSRF token and origin checks), and explicit credentialed CORS with a non-wildcard origin and `Access-Control-Allow-Credentials`.
