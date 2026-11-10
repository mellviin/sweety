# Security Notes

I have added several security measures to Sweety to protect user accounts, glucose records, API requests, and database access.

The table below summarises the main threats I considered, the measures I implemented, and where they are covered in the project.

## Security controls

| Threat | What I implemented | Files | Tests / Evidence |
|---|---|---|---|
| Unauthenticated or remotely accessible local database | I require explicit PostgreSQL credentials and bind the published database port to `127.0.0.1`. | `docker-compose.yml` | `server/src/db/security-config.test.js` |
| Application role gaining excessive privileges or modifying the database schema | I separated the application and migration roles. The application role is a non-superuser with limited CRUD permissions and sequence access. | `server/src/db/init/001_create_databases.sql`, `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Invalid or duplicate glucose records and incorrect user deletion behaviour | I added database constraints for required values, glucose ranges, reading slots, case-insensitive email uniqueness, reading uniqueness, and cascading foreign keys. | `server/src/db/migrations/002_hardening.sql` | `server/src/db/roles.test.js` |
| Excessive database resource usage or queries running indefinitely | I configured a maximum connection-pool size along with idle, connection, and statement timeouts. | `server/src/db/pool.js` | Server test suite |
| API server accessing schema-altering credentials or failing when migration configuration is unavailable | I made the migration pool lazy-loaded and restricted its use to migration, seed, and test operations. The application database URL is validated during startup with a clear error message. | `server/src/db/pool.js`, `server/src/server.js`, `server/src/db/migrate.js` | `server/src/db/security-config.test.js`, `server/src/db/roles.test.js` |
| Browser injection, unwanted cross-origin requests, cached sensitive responses, malformed or oversized request bodies, and slow connections | I added Helmet security headers, exact-origin CORS, no-store headers, request-size limits, body validation, HPP protection, and HTTP server timeouts. | `server/src/app.js`, `server/src/middleware/httpHardening.js`, `server/src/middleware/errorHandler.js`, `server/src/server.js` | `server/src/app.test.js` |
| Brute-force login attempts and excessive API or reading-write requests | I added configurable global, authentication, failed-login, and per-user reading-write rate limits. The API also returns `Retry-After` when a limit is reached. Failed-login tracking uses a SHA-256 email hash along with the IP and timestamp. | `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`, `server/src/routes/readings.js` | `server/src/app.test.js`, `server/src/routes/auth.test.js`, `server/src/routes/readings.test.js` |
| Weak or reused passwords, login enumeration, forged or stale tokens, and compromised sessions | I added a common-password check, dummy bcrypt comparison for unknown users, JWT validation for HS256 and required claims, and token-version invalidation on logout and password change. | `server/src/services/authService.js`, `server/src/services/passwordPolicy.js`, `server/src/middleware/auth.js`, `server/src/db/migrations/003_auth_hardening.sql` | `server/src/routes/auth.test.js` |
| Cross-user reading access, mass assignment, malformed inputs, and SQL injection | I scope reading and report queries to the authenticated user, reject unknown request fields (including `user_id` and `userId`), validate IDs, dates and pagination, and use parameterized SQL queries. | `server/src/services/readingService.js`, `server/src/services/reportService.js`, `server/src/middleware/strictFields.js`, `server/src/db/seed.js` | `server/src/routes/readings.test.js`, `server/src/routes/reports.test.js`, `server/src/routes/auth.test.js`, `server/src/security/sqlQuerySafety.test.js` |
| Exposure of bearer tokens and client-side script injection | I use the Authorization-header authentication approach and store the token in `sessionStorage`. The client clears it on logout and unauthorized responses. I also use ESLint and CSP controls to avoid dangerous React HTML insertion. | `client/src/api/client.js`, `client/src/context/AuthContext.jsx`, `client/eslint.config.js`, `client/index.html`, `client/vite.config.js` | `client/src/api/client.test.js`, `client/src/App.test.jsx` |
| Sensitive information leaking through logs or missing security-event records | I added structured JSON logging with an allow-list of fields, control-character sanitisation, masked email addresses, and validated request IDs. I also store limited authentication and rate-limit events in a database table with restricted application-role permissions. | `server/src/utils/logger.js`, `server/src/middleware/requestContext.js`, `server/src/services/securityEventService.js`, `server/src/db/migrations/004_security_events.sql` | `server/src/app.test.js`, `server/src/routes/auth.test.js`, `server/src/db/roles.test.js` |
| Vulnerable dependencies, leaked secrets, and unreviewed code changes | I added lockfile-based dependency installation, high/critical npm audits, Gitleaks history scanning, Trivy filesystem scanning, and CodeQL. Dependabot is configured to suggest weekly dependency updates, and workflow permissions are restricted. | `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml`, `server/package-lock.json`, `client/package-lock.json` | CI audit, Gitleaks, Trivy, and CodeQL jobs |

## OWASP Top 10 (2021) coverage

I also reviewed the project against the OWASP Top 10 (2021) categories to understand which common application security risks are addressed.

| Category | How I addressed it in Sweety | Files | Tests / Evidence |
|---|---|---|---|
| A01 – Broken Access Control | I protect private routes with authentication, derive reading ownership from the verified token, return 404 for another user's readings, and restrict database-role permissions. | `server/src/middleware/auth.js`, `server/src/services/readingService.js`, `server/src/services/reportService.js`, `server/src/db/init/001_create_databases.sql`, `server/src/db/migrations/002_hardening.sql` | `server/src/routes/readings.test.js`, `server/src/routes/reports.test.js`, `server/src/db/roles.test.js` |
| A02 – Cryptographic Failures | I hash passwords using bcrypt with cost 12 and protect JWTs using HS256, a minimum 32-character secret, issuer, audience, and expiry checks. Production TLS must be configured by the deployment environment. | `server/src/services/authService.js`, `server/src/services/passwordPolicy.js`, `server/src/config/env.js` | `server/src/routes/auth.test.js`, `server/src/db/security-config.test.js` |
| A03 – Injection | I reject malformed and unknown inputs, use parameterized SQL, check application SQL for unsafe interpolation, and rely on React's default text escaping instead of dangerous HTML insertion. | `server/src/middleware/strictFields.js`, `server/src/services/readingService.js`, `server/src/services/reportService.js`, `server/src/security/sqlQuerySafety.test.js`, `client/src` | `server/src/routes/readings.test.js`, `server/src/routes/auth.test.js`, `server/src/security/sqlQuerySafety.test.js`, `client/src/App.test.jsx` |
| A04 – Insecure Design | I apply rate limits, enforce reading limits and uniqueness, scope reports to individual users, and use generic login failures with a dummy password comparison for unknown accounts. | `server/src/middleware/rateLimit.js`, `server/src/services/readingService.js`, `server/src/services/authService.js`, `server/src/services/reportService.js` | `server/src/routes/auth.test.js`, `server/src/routes/readings.test.js`, `server/src/routes/reports.test.js` |
| A05 – Security Misconfiguration | I configure API security headers, exact-origin CORS, database and JWT configuration validation, localhost-only database binding, and production CSP guidance. | `server/src/app.js`, `server/src/config/env.js`, `docker-compose.yml`, `client/index.html`, `docs/SECURITY.md` | `server/src/app.test.js`, `server/src/db/security-config.test.js` |
| A06 – Vulnerable Components | I use committed lockfiles and `npm ci`. CI runs high-severity npm audits and Trivy scans, while Dependabot suggests weekly dependency updates. | `server/package-lock.json`, `client/package-lock.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml` | CI server/client audit and Trivy jobs |
| A07 – Identification and Authentication Failures | I enforce password rules, compare a dummy hash for unknown users, validate JWT algorithms and claims, invalidate tokens on logout and password change, and clear client tokens on logout or 401 responses. | `server/src/services/authService.js`, `server/src/services/passwordPolicy.js`, `server/src/middleware/auth.js`, `client/src/api/client.js`, `client/src/context/AuthContext.jsx` | `server/src/routes/auth.test.js`, `client/src/api/client.test.js`, `client/src/App.test.jsx` |
| A08 – Software and Data Integrity Failures | I track ordered database migrations, use lockfile-based CI installs, scan the repository and filesystem, and run CodeQL. GitHub Actions currently use full version tags rather than immutable commit SHAs. | `server/src/db/migrate.js`, `server/src/db/migrations`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.gitleaksignore` | `server/src/db/migrate.test.js`, CI Gitleaks/Trivy/CodeQL jobs |
| A09 – Security Logging and Monitoring Failures | I added request IDs, structured logs with an approved field list, sanitised and masked values, and limited security-event records that do not contain credentials. | `server/src/utils/logger.js`, `server/src/middleware/requestContext.js`, `server/src/services/securityEventService.js`, `server/src/db/migrations/004_security_events.sql` | `server/src/app.test.js`, `server/src/routes/auth.test.js`, `server/src/db/roles.test.js` |
| A10 – Server-Side Request Forgery (SSRF) | SSRF is not applicable to the current API because it does not fetch or proxy URLs supplied by users and does not make outbound HTTP client requests. I would reassess this if URL-fetching or webhook features are added. | `server/src` | No dedicated SSRF test. The absence of outbound request code should be confirmed during review. |

## Browser security headers

For the production Vite build, I have included a CSP meta-tag fallback. During development, this is removed so that Vite HMR can work properly.

One limitation is that a CSP meta tag cannot enforce `frame-ancestors`. Because of this, I recommend configuring the production CSP as an actual HTTP response header through the web server or CDN.

For a deployment using an Nginx reverse proxy with the frontend and `/api` on the same origin, the following is an example response header:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests" always;
```

If the API is hosted on a separate origin, I need to add only that exact HTTPS origin to `connect-src` in both the response header and CSP meta fallback.

I keep `frame-ancestors` in the response header because browsers ignore this directive when it is provided through a meta policy.

## Known limitations and what I would improve next

Although I have added several security controls, there are still areas that need further work before treating Sweety as production-ready.

- Example passwords and database connection strings are placeholders. Anyone deploying the application must provide strong, unique credentials and protect real `.env` files.
- Existing Docker containers retain their previous port binding until they are recreated. The database initialization script creates roles only when a new data volume is initialized.
- Recreating the database volume applies updated role provisioning, but it permanently deletes the local database data.
- PostgreSQL permissions and constraints do not replace backups or encryption at rest. Both need to be configured and tested for production.
- Failed-login counters currently exist in application memory. They are not shared between multiple API instances and are not preserved after a restart.
- Registration intentionally retains the assignment-required `409` duplicate-email response. This reveals whether an email address is already registered. Changing this behaviour would require changing the agreed API response.
- Request validation rejects unknown body and query fields with HTTP 400. Clients must not send additional fields such as `user_id` or `userId`.
- The bearer token is still accessible to same-origin JavaScript through `sessionStorage`. This reduces persistence compared with `localStorage`, but it does not prevent token theft if an attacker successfully exploits XSS.
- Security-event records include IP addresses and user-agent strings. A suitable retention period and access policy need to be established for the deployment.
- Full-history Gitleaks scanning identified a possible JWT-secret-like value in `.env.example` at commit `838275bb09896574545ec6b4b4a1dac7b3829275`. The finding is currently baselined in `.gitleaksignore`, and the Git history has not been rewritten. Any credential that may have reused that value should be treated as exposed and rotated.
- The current authentication flow does not include MFA, email verification, password reset, or refresh tokens.
- GitHub Actions are pinned to full version tags rather than immutable commit SHAs. Tags can theoretically be moved.
- The application does not enforce TLS itself or provide a WAF or reverse proxy. Production deployment must provide TLS termination and network-level protection.
- There is no production secrets-manager integration yet. Deployment operators must provision and rotate secrets securely.
- I have not performed a professional penetration test. Automated tests and security scanners are useful, but they are not a replacement for independent security testing.

### Next security improvements

The next improvements I would focus on are:

1. Add MFA, email verification, and a secure password-reset flow.
2. Evaluate refresh-token rotation and session revocation.
3. Move bearer-token authentication to `HttpOnly`, `Secure`, and `SameSite` cookies.
4. Implement CSRF protection using CSRF tokens and origin checks, with the required frontend/backend changes and explicit credentialed CORS configuration.
5. Add a production WAF and TLS-terminating reverse proxy.
6. Integrate a secrets manager for production credentials.
7. Configure encrypted database backups and regularly test the restore process.
8. Arrange an independent professional penetration test.

Cookie-based authentication needs to be implemented together with CSRF protection, trusted-origin checks, and correct CORS configuration. Moving the token into a cookie alone would not be enough.