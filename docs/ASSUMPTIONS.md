## Assumptions

These are the assumptions and implementation decisions I followed while building Sweety:

- I use `http://localhost:5173` as the default Vite development client URL and allowed browser origin.
- The backend API runs on port `3000` by default. This can be changed using the `PORT` environment variable.
- The server requires Node.js 20 or newer to use patched versions of the transitive `glob` and `minimatch` dependencies.
- If both root `.env` and `server/.env` files exist, the values in `server/.env` take priority.
- The `previousMonthRange(date)` utility returns inclusive `startDate` and `endDate` strings for the calendar month before the month containing the selected date.
- I use Docker Compose for local development. PostgreSQL is bound to localhost, with separate application and migration database roles.
- Database migrations handle the schema setup but do not create demo data. I use the seed command separately to create or refresh the demo account and its readings.
- User passwords are hashed using bcrypt with 12 rounds. Authentication integration tests use the database configured through `TEST_DATABASE_URL`.
- Reading validation checks the maximum of four readings per date before checking for duplicate slots. This means a fifth reading returns the daily-limit error, even if the selected slot is already occupied.
- Demo readings are generated deterministically. They cover the 21 days ending yesterday, along with a reading on the last day of the previous month when that date falls outside the 21-day range.
- API rate limits have the following defaults:
  - Global API requests: 300 per IP every 15 minutes.
  - Authentication requests: 20 per IP every 15 minutes.
  - Failed login attempts: 5 per SHA-256 email hash every 15 minutes.
  - Reading write operations: 60 per authenticated user every 15 minutes.
  - Rate limiting is disabled when `NODE_ENV=test`, unless `RATE_LIMIT_ENABLED=true`.
- I use the Vite development proxy to forward frontend requests from `/api` to the backend. The proxy removes the `/api` prefix and forwards requests to `http://localhost:3000` by default.
- The client stores the JWT in browser local storage so that the user's login session can be restored after refreshing the page.
- The Dashboard date picker initially selects the current date based on the configured application timezone. When the selected date changes, the reading form is reset and edit mode is exited to prevent editing a reading associated with a different date.
- The Reports chart displays individual readings as points ordered by date and time slot. It includes readings from the first day of the selected calendar month up to and including the selected date.