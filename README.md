# Sweety

Sweety is a blood glucose tracker. The initial scaffold provides an Express API and PostgreSQL database foundation.

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
5. In `client`, run `npm install` and `npm run dev` to start the Vite frontend.

The authentication API provides `POST /auth/register`, `POST /auth/login`, and protected `GET /auth/me`. Both registration and login return a bearer token and a safe user object. Protected readings endpoints support `POST /readings`, paginated/filterable `GET /readings`, `GET /readings/:id`, `PUT /readings/:id`, and `DELETE /readings/:id`. Send the token in `Authorization: Bearer <token>`.

Protected reports are available at `GET /reports/daily?date=YYYY-MM-DD`, `GET /reports/month-to-date?date=YYYY-MM-DD`, and `GET /reports/monthly?date=YYYY-MM-DD`. Each report is scoped to the logged-in user.

The authentication endpoints are limited by `AUTH_RATE_LIMIT_MAX` requests in `AUTH_RATE_LIMIT_WINDOW_MS` milliseconds per IP (20 requests per 15 minutes by default). Rate limiting is disabled in test mode.

Run `npm run seed` from `server` to create or refresh the deterministic demo readings for `demo@sweety.test` / `Demo@1234`. It applies migrations first and resets only that demo user's readings.

Use [server/requests.http](./server/requests.http) with the VS Code REST Client extension to exercise registration, login, readings validation, and reports.

The Jest integration tests use `TEST_DATABASE_URL` and apply the schema to that database. Set it in `.env` before running tests; test records are truncated between tests.

Run tests and lint from `server` with `npm test` and `npm run lint`; build the frontend from `client` with `npm run build`.

## Notes

See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) for implementation assumptions.
