# Assumptions

- The Vite development client runs at `http://localhost:5173`, which is the default allowed browser origin.
- The API listens on port `3000` unless `PORT` is set.
- The server requires Node.js 20 or newer to use patched transitive `glob` and `minimatch` releases.
- When both exist, `server/.env` values take precedence over root `.env` values.
- `previousMonthRange(date)` returns inclusive `startDate` and `endDate` strings for the month preceding the date's month.
- Docker Compose is for local development and uses PostgreSQL's trust authentication; do not expose this service outside a trusted local environment.
- No initial application data is required, so the seed script currently completes with a message and makes no database changes.
- Passwords use bcrypt with 12 rounds, and authentication integration tests use only the database configured by `TEST_DATABASE_URL`.
