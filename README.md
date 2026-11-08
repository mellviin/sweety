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

Run tests and lint from `server` with `npm test` and `npm run lint`; build the frontend from `client` with `npm run build`.

## Notes

See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) for implementation assumptions.
