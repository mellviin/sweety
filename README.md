# Sweety

Sweety is a blood glucose tracker with a React web client, an Express API, and a PostgreSQL database.

## Local setup

1. Copy `.env.example` to `.env` (or `server/.env.example` to `server/.env`) and adjust values if needed.
2. Start PostgreSQL with `docker compose up -d`.
3. From `server`, install dependencies and run the database migration:

   ```sh
   npm install
   npm run migrate
   npm run dev
   ```

4. Check `http://localhost:3000/health`; it should return `{"status":"ok"}`.
5. In `client`, run `npm install` and `npm run dev` to start the Vite frontend at `http://localhost:5173`. The development server proxies `/api` requests to the API on port `3000`; set `VITE_API_PROXY_TARGET` in `client/.env` to change the target.

The web client provides account registration and login, protected Dashboard and Reports pages, and logout. The Dashboard lets users choose a date, review and manage that day's readings, and receive server-side validation messages. It restores an existing session by validating the saved token with `GET /auth/me`. The authentication API provides `POST /auth/register`, `POST /auth/login`, and protected `GET /auth/me`. Both registration and login return a bearer token and a safe user object. Protected readings endpoints support `POST /readings`, paginated/filterable `GET /readings`, `GET /readings/:id`, `PUT /readings/:id`, and `DELETE /readings/:id`. Send the token in `Authorization: Bearer <token>`.

Protected reports are available at `GET /reports/daily?date=YYYY-MM-DD`, `GET /reports/month-to-date?date=YYYY-MM-DD`, and `GET /reports/monthly?date=YYYY-MM-DD`. The Reports page displays their date ranges, summaries, and daily readings. `GET /reports/chart?date=YYYY-MM-DD` returns the logged-in user's selected-month readings through the requested date for charting. Every report endpoint is scoped to the logged-in user.

The authentication endpoints are limited by `AUTH_RATE_LIMIT_MAX` requests in `AUTH_RATE_LIMIT_WINDOW_MS` milliseconds per IP (20 requests per 15 minutes by default). Rate limiting is disabled in test mode.

Run `npm run seed` from `server` to create or refresh the deterministic demo readings for `demo@sweety.test` / `Demo@1234`. It applies migrations first and resets only that demo user's readings.

Use [server/requests.http](./server/requests.http) with the VS Code REST Client extension to exercise registration, login, readings validation, and reports.

The Jest integration tests use `TEST_DATABASE_URL` and apply the schema to that database. Set it in `.env` before running tests; test records are truncated between tests.

Run backend tests and lint from `server` with `npm test` and `npm run lint`. From `client`, run `npm test`, `npm run lint`, and `npm run build` to test, lint, and build the frontend.

## Notes

See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) for implementation assumptions.
