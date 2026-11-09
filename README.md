# Sweety

Sweety is a blood glucose tracker for recording daily readings and reviewing trends. It includes a React web application, a user-scoped Express API, and a PostgreSQL database.

## Features

- Register and log in with bcrypt-hashed passwords and JWT-protected API access.
- Add, list, edit, and delete glucose readings for four daily time slots.
- Enforce date, glucose value, slot, duplicate-slot, and daily reading-limit rules on the server.
- View daily, month-to-date, and previous-calendar-month summaries.
- Explore readings for the selected month in a line chart.
- Use a deterministic demo seed account and a PostgreSQL Docker Compose service.

## Tech stack

- Node.js ES modules and Express
- PostgreSQL 16 with `pg` and parameterized SQL (no ORM)
- React, Vite, React Router, Axios, and Recharts
- Jest and Supertest for API integration tests; Vitest, jsdom, and React Testing Library for client tests
- ESLint and GitHub Actions CI

## Prerequisites

- Node.js 20 or newer and npm
- Either Docker with the Compose plugin, or a local PostgreSQL 16 server
- Git

## Installation

Clone the repository, then install the server and client dependencies:

```sh
git clone <repository-url>
cd sweety_glucose_tracker
cd server
npm install
cd ../client
npm install
cd ..
```

## Database setup

### Option A: Docker Compose

From the repository root, start PostgreSQL:

```sh
cp .env.example .env
# Replace all replace-with-* values with distinct, private values.
docker compose up -d
```

The PostgreSQL 16 container binds port `5432` to localhost, persists its data in a named volume, and creates both `sweety` and `sweety_test` databases on first initialization. It requires `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, and `MIGRATE_DB_PASSWORD`; no password defaults are provided. Check readiness with `docker compose ps`.

To recreate the development database and rerun the initialization script after changing role setup:

```sh
docker compose down --volumes
docker compose up -d
cd server
npm run migrate
```

`docker compose down --volumes` permanently deletes the local PostgreSQL data volume. The initialization script runs only when PostgreSQL creates an empty data directory.

### Option B: Local PostgreSQL

Create two databases on your local PostgreSQL instance:

```sql
CREATE DATABASE sweety;
CREATE DATABASE sweety_test;
```

For local PostgreSQL, provision equivalent `sweety_app` and `sweety_migrate` roles and grants, then set the connection strings in `server/.env`. Use URL-encoded credentials if passwords contain reserved URL characters.

### Apply migrations

After database setup and environment configuration:

```sh
cd server
npm run migrate
```

Migrations are ordered, tracked, and safe to rerun.

## Environment setup

Copy the server template to `server/.env` and the client template to `client/.env`. The root `.env.example` mirrors the server settings for users who prefer a repository-root environment file; the server loads `server/.env` first and then the root `.env`.

```sh
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Do not use the example JWT value outside local development. Replace it with a strong, private value. `.env` files are ignored by Git.

### Server variables

| Variable | Purpose | Default/example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by the API and seed command. | `postgresql://sweety_app:<password>@localhost:5432/sweety` |
| `MIGRATION_DATABASE_URL` | Connection string for the schema-owning role, used only by the migrate/seed commands and test setup; not needed by the API server. | `postgresql://sweety_migrate:<password>@localhost:5432/sweety` |
| `TEST_DATABASE_URL` | Dedicated app-role connection string used by Jest; migrations are applied with `MIGRATION_DATABASE_URL`. | `postgresql://sweety_app:<password>@localhost:5432/sweety_test` |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL initialization superuser, used by Docker Compose. | Set a private value; no default. |
| `APP_DB_PASSWORD` | Password for the least-privilege app role. | Set a private value. |
| `MIGRATE_DB_PASSWORD` | Password for the schema-owning migration role. | Set a private value distinct from the app password. |
| `JWT_SECRET` | Secret used to sign and verify API tokens. Required to start the API; must be at least 32 characters. | Replace the example value with a private random secret. |
| `JWT_EXPIRES_IN` | JWT lifetime accepted by `jsonwebtoken` (for example `1h`). | `1h` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Issuer and audience required on every API access token. | `sweety-api` / `sweety-client` |
| `NODE_ENV` | Node runtime mode; tests set this to `test`, which disables auth rate limiting and selects `TEST_DATABASE_URL`. | `development` |
| `PORT` | Express listening port. | `3000` |
| `CLIENT_URL` | Allowed browser origin for CORS. | `http://localhost:5173` |
| `TRUST_PROXY` | Express trusted proxy setting for client IP detection and rate limiting. Accepts `true`, `false` (default), a hop count, or a comma-separated proxy/IP list. | `false` |
| `APP_TIMEZONE` | IANA timezone used for the app's current-date and future-date checks. | `Asia/Kolkata` |
| `AUTH_RATE_LIMIT_MAX` | Maximum auth requests per IP during the rate-limit window. | `20` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate-limit window in milliseconds. | `900000` (15 minutes) |
| `GLOBAL_RATE_LIMIT_MAX` / `GLOBAL_RATE_LIMIT_WINDOW_MS` | Requests per IP across the API and the limit window in milliseconds. | `300` / `900000` |
| `LOGIN_FAILURE_RATE_LIMIT_MAX` / `LOGIN_FAILURE_RATE_LIMIT_WINDOW_MS` | Failed logins per SHA-256 email hash and the rolling window in milliseconds. | `5` / `900000` |
| `READING_WRITE_RATE_LIMIT_MAX` / `READING_WRITE_RATE_LIMIT_WINDOW_MS` | POST/PUT/DELETE readings per authenticated user and the window in milliseconds. | `60` / `900000` |
| `RATE_LIMIT_ENABLED` | Explicitly enables rate limits under `NODE_ENV=test`; production/development limits are enabled by default. | `false` |

### Client variables

| Variable | Purpose | Default/example |
|---|---|---|
| `VITE_API_URL` | Axios API base path. Use `/api` with the Vite proxy. | `/api` |
| `VITE_API_PROXY_TARGET` | Backend origin the Vite development proxy forwards `/api` requests to. | `http://localhost:3000` |
| `VITE_APP_TIMEZONE` | IANA timezone used to choose today's date in date pickers. | `Asia/Kolkata` |

## Run the application

Start the API in one terminal:

```sh
cd server
npm run dev
```

The API listens on `http://localhost:3000` by default. `GET /health` should return `{"status":"ok"}`.

Start the client in another terminal:

```sh
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` to the server. In a separate terminal, use `npm start` in `server` for the non-watch server process.

## Run tests and lint

The server test suite uses `TEST_DATABASE_URL` as `sweety_app` for application operations and the credentials in `MIGRATION_DATABASE_URL` against the test host/database for migrations and cleanup. Use only a disposable `sweety_test` database.

```sh
cd server
npm test
npm run lint
```

Run client tests, lint, and a production build:

```sh
cd client
npm test
npm run lint
npm run build
```

GitHub Actions runs database migration, both linters, both test suites, and the client production build on pushes and pull requests.

## Seed demo data

From `server`, run:

```sh
npm run seed
```

Run `npm run migrate` first. The seed command uses the app role to create or refresh demo data and prints the date range and count. Demo credentials:

- Email: `demo@sweety.test`
- Password: `Demo@1234`

The seed is deterministic and is intended for local development and demonstrations.

## API summary

All paths are relative to the API origin. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---:|---|
| `GET` | `/health` | No | API health check. |
| `POST` | `/auth/register` | No | Create an account and return a JWT and safe user object. |
| `POST` | `/auth/login` | No | Authenticate and return a JWT and safe user object. |
| `GET` | `/auth/me` | Yes | Return the authenticated user. |
| `POST` | `/readings` | Yes | Add a reading with `{ date, slot, value }`. |
| `GET` | `/readings?date=&page=1&limit=20` | Yes | List the caller's readings, optionally filtered by date and paginated. |
| `GET` | `/readings/:id` | Yes | Get one of the caller's readings. |
| `PUT` | `/readings/:id` | Yes | Update one of the caller's readings. |
| `DELETE` | `/readings/:id` | Yes | Delete one of the caller's readings (204 on success). |
| `GET` | `/reports/daily?date=YYYY-MM-DD` | Yes | Daily summary and slot-ordered readings. |
| `GET` | `/reports/month-to-date?date=YYYY-MM-DD` | Yes | Summary from the first of the selected month through the date. |
| `GET` | `/reports/monthly?date=YYYY-MM-DD` | Yes | Summary for the whole calendar month before the selected date's month. |
| `GET` | `/reports/chart?date=YYYY-MM-DD` | Yes | Selected-month readings from day one through the selected date. |

Reading slots are `MORNING_FASTING`, `AFTER_BREAKFAST`, `AFTER_LUNCH`, and `AFTER_DINNER`. API errors use `{ "error": { "field": "<field or null>", "message": "<message>" } }`.

## Reading validation rules

Validation is server-side and returns the first applicable error. The order and exact messages are:

| Order | Condition | Field | Status | Exact message |
|---:|---|---|---:|---|
| 1 | Value missing, empty, or null | `value` | 400 | `Please enter a glucose value.` |
| 2 | Value is not a whole number from 40 through 600 | `value` | 400 | `Value must be between 40 and 600 mg/dl.` |
| 3 | Slot missing or not one of the four supported slots | `slot` | 400 | `Please select a time slot.` |
| 4 | Date missing or not a real `YYYY-MM-DD` calendar date | `date` | 400 | `Please enter a valid date.` |
| 5 | Date is after today in `APP_TIMEZONE` | `date` | 400 | `Date cannot be in the future.` |
| 6 | User already has four readings on the date (excluding the edited reading) | `date` | 409 | `You can add only 4 readings per day.` |
| 7 | User already has that slot on that date (excluding the edited reading) | `slot` | 409 | `You already have an {Slot label} reading for this date.` |

The four-per-day rule precedes duplicate-slot checking, so a fifth reading reports the daily limit. A reading owned by another user and a nonexistent reading both return 404 `Reading not found.` rather than revealing another user's record.

## Reports and date ranges

For `date=2026-10-15`, the inclusive periods are:

| Report | From | To |
|---|---|---|
| Daily | `2026-10-15` | `2026-10-15` |
| Month to date | `2026-10-01` | `2026-10-15` |
| Previous month | `2026-09-01` | `2026-09-30` |

Each summary returns `from`, `to`, `count`, `highest`, `lowest`, and `average`. The average is rounded to one decimal place; empty periods return count `0` and null aggregate values. Daily reports also include slot-ordered readings. The previous-month endpoint always uses the entire previous calendar month, including when moving from January to the preceding December.

## Project structure

```text
.
├── .github/workflows/ci.yml
├── client/
│   ├── src/
│   │   ├── api/                 # Axios client and auth token handling
│   │   ├── components/          # Forms, navigation, shared UI and chart
│   │   ├── context/             # Authentication state
│   │   ├── pages/               # Login, register, dashboard, reports
│   │   ├── test/                # Vitest setup
│   │   └── utils/               # Slot labels and date/error helpers
│   └── vite.config.js
├── docs/
│   ├── ASSUMPTIONS.md
│   └── DEMO_SCRIPT.md
├── server/
│   ├── src/
│   │   ├── config/              # Environment configuration
│   │   ├── controllers/
│   │   ├── db/                  # Pool, migrations, seed and SQL
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/            # Business rules and parameterized SQL
│   │   └── utils/
│   └── test/                    # Jest setup and fixtures
├── .env.example
└── docker-compose.yml
```

## Screenshots

Screenshots are not included yet. Add images under `docs/screenshots/` and link them here when ready (for example, `docs/screenshots/dashboard.png`, `docs/screenshots/reports.png`).

## Notes and assumptions

- Timezone defaults to `Asia/Kolkata`; the server and client use their respective `APP_TIMEZONE` / `VITE_APP_TIMEZONE` setting when calculating today.
- Reading dates are plain `YYYY-MM-DD` strings. PostgreSQL `DATE` results are parsed as strings, and date comparisons and report boundaries avoid timezone-dependent date conversions.
- “Previous month” means the entire calendar month immediately preceding the selected date's month, inclusive of its first and last day.
- Reading validation checks value presence, value range, slot, valid date, future date, four-per-day limit, and duplicate slot in that order. The daily maximum check precedes duplicate checking.
- Reading APIs scope queries to the authenticated user. A nonexistent or another user's reading returns 404, not 403, to avoid disclosing record existence.
- Further implementation assumptions are recorded in [docs/ASSUMPTIONS.md](./docs/ASSUMPTIONS.md).

### What I would improve with more time

- Replace local-storage bearer tokens with HTTP-only, secure cookies and a refresh-token rotation/session-revocation design.
- Add browser-based end-to-end flows and accessibility automation, including broader screen-reader and keyboard checks.
- Add deployment-specific secret management, observability, database backup guidance, and CI coverage for supported Node/PostgreSQL versions.
- Add report caching only after measuring query patterns and defining cache invalidation for reading changes.
- Add an optional clinician/doctor role with explicit patient consent and narrowly scoped access controls.

## Bonus tasks completed

- **Pagination:** protected reading-list endpoint supports validated `page` and `limit` parameters.
- **Chart:** protected reports chart endpoint and responsive Recharts line chart with slot-aware tooltips.
- **Docker:** PostgreSQL 16 Compose service, health check, named volume, and initialization of app and test databases.
- **Frontend tests:** Vitest/jsdom/React Testing Library coverage for auth, reading management, reports, protected routing, and date formatting.

## Final assignment audit

| Requirement | Implementation | Test coverage / evidence | Status |
|---|---|---|---|
| Sign up/login with bcrypt-hashed passwords | `server/src/services/authService.js`, `server/src/controllers/authController.js` | `server/src/routes/auth.test.js` checks registration, bcrypt hash, login, and no password hash in responses | Complete |
| Users only see their own readings | `server/src/services/readingService.js`, `server/src/services/reportService.js` | `server/src/routes/readings.test.js` covers cross-user read/update/delete; `server/src/routes/reports.test.js` covers report scoping | Complete |
| Add/view/edit/delete readings with date, slot, and value | `client/src/components/ReadingForm.jsx`, `client/src/pages/Dashboard.jsx`, `server/src/services/readingService.js` | `client/src/components/ReadingForm.test.jsx`, `client/src/pages/Dashboard.test.jsx`, `server/src/routes/readings.test.js` | Complete |
| Missing-value, range, slot, and invalid-date validation with exact messages | `server/src/services/readingService.js`, `client/src/components/ReadingForm.jsx` | `server/src/routes/readings.test.js`, `client/src/components/ReadingForm.test.jsx` | Complete |
| Future-date, daily maximum, and duplicate-slot validation with exact messages/statuses | `server/src/services/readingService.js` | `server/src/routes/readings.test.js`, `client/src/components/ReadingForm.test.jsx` | Complete |
| Daily, month-to-date, previous-month reports with aggregate metrics and empty state | `server/src/services/reportService.js`, `client/src/pages/Reports.jsx` | `server/src/routes/reports.test.js`, `client/src/pages/Reports.test.jsx` | Complete |
| Daily report lists readings by slot | `server/src/services/reportService.js`, `client/src/pages/Reports.jsx` | `server/src/routes/reports.test.js`, `client/src/pages/Reports.test.jsx` | Complete |
| Pagination | `server/src/services/readingService.js` | `server/src/routes/readings.test.js` pagination case | Complete |
| Chart API and responsive chart UI | `server/src/services/reportService.js`, `server/src/routes/reports.js`, `client/src/components/ReportChart.jsx` | `server/src/routes/reports.test.js`, `client/src/pages/Reports.test.jsx` | Complete |
| README, environment examples, and seed script | `README.md`, `.env.example`, `server/.env.example`, `client/.env.example`, `server/src/db/seed.js` | `server/src/db/seed.test.js`; tracked environment files checked against `process.env` / `import.meta.env` references | Complete |
| Docker Compose database setup | `docker-compose.yml`, `server/src/db/init/001_create_databases.sql` | Compose service health check; fresh setup commands documented above | Complete |
| Regular small commits | Git history | `git log --oneline` shows staged implementation, test, and documentation commits across steps | Complete |

## Security and local-development notes

- Never commit `.env` files or production credentials. Every example secret/password is a placeholder.
- Docker Compose is for local development; its database port is bound to localhost. Use a managed secrets mechanism and network controls for deployments.
- Set `TRUST_PROXY` only to match the trusted reverse proxy topology. Leave it unset/off when the API is directly reachable; trusting arbitrary forwarded headers can undermine IP-based rate limiting.
- Failed-login email keys are SHA-256 hashes held in process memory for the configured window. With multiple API instances, use a shared rate-limit store to enforce consistent limits across instances.
- Jest truncates test tables. Set `TEST_DATABASE_URL` to the dedicated test database, never to a database with data you need.
