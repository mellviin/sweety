# Assumptions

- The Vite development client runs at `http://localhost:5173`, which is the default allowed browser origin.
- The API listens on port `3000` unless `PORT` is set.
- The server requires Node.js 20 or newer to use patched transitive `glob` and `minimatch` releases.
- When both exist, `server/.env` values take precedence over root `.env` values.
- `previousMonthRange(date)` returns inclusive `startDate` and `endDate` strings for the month preceding the date's month.
- Docker Compose is for local development and uses PostgreSQL's trust authentication; do not expose this service outside a trusted local environment.
- Migrations do not create demo data; the seed command explicitly creates and refreshes the demo account and readings.
- Passwords use bcrypt with 12 rounds, and authentication integration tests use only the database configured by `TEST_DATABASE_URL`.
- Reading validation checks the four-per-date maximum before checking for a duplicate slot, so a fifth reading reports the daily limit even when its slot also exists.
- Demo seed readings are deterministic and span the 21 days ending yesterday, plus a reading on the last day of the previous month relative to yesterday when that day is outside the 21-day range.
- The authentication rate limit defaults to 20 requests per IP per 15 minutes and is disabled when `NODE_ENV=test`.
- The React client uses the Vite development proxy at `/api`, which strips that prefix and forwards requests to `http://localhost:3000` by default.
- The client persists the JWT in browser local storage so a logged-in session can be restored after a page reload.
