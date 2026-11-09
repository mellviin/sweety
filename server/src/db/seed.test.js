import request from "supertest";
import app from "../app.js";
import { migrationPool, pool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { seedDemoData } from "./seed.js";

beforeAll(async () => {
  await runMigrations(migrationPool);
});

beforeEach(async () => {
  await migrationPool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await migrationPool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  await pool.end();
  await migrationPool.end();
});

test("seeds varied readings and allows the demo user to log in", async () => {
  const summary = await seedDemoData(pool);
  const result = await pool.query(
    `SELECT
       count(*)::int AS count,
       count(DISTINCT reading_date)::int AS days,
       min(reading_date)::text AS first_date,
       max(reading_date)::text AS last_date
     FROM readings
     WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [summary.email],
  );
  const [readings] = result.rows;
  const login = await request(app)
    .post("/auth/login")
    .send({ email: summary.email, password: summary.password });

  expect(summary.readingCount).toBeGreaterThan(0);
  expect(readings.count).toBe(summary.readingCount);
  expect(readings.days).toBeGreaterThan(10);
  expect(readings.last_date).toBe(summary.to);
  expect(readings.first_date).toBe(summary.from);
  expect(login.status).toBe(200);
  expect(login.body.user.email).toBe(summary.email);
});

test("is idempotent and leaves other users unchanged", async () => {
  const firstSeed = await seedDemoData(pool);
  const firstReadings = await pool.query(
    `SELECT reading_date::text AS date, slot, value
     FROM readings
     WHERE user_id = (SELECT id FROM users WHERE email = $1)
     ORDER BY reading_date, slot`,
    [firstSeed.email],
  );
  const demo = await pool.query(
    `UPDATE users
     SET name = 'Keep This Name', password_hash = 'keep-this-hash'
     WHERE email = $1
     RETURNING id`,
    [firstSeed.email],
  );
  const otherUser = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ('Other User', 'other-seed@example.com', 'other-hash')
     RETURNING id`,
  );
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, value)
     VALUES ($1, '2026-01-01', 'MORNING_FASTING', 110)`,
    [otherUser.rows[0].id],
  );

  const secondSeed = await seedDemoData(pool);
  const repeatedSeed = await seedDemoData(pool);
  const users = await pool.query(
    "SELECT name, password_hash FROM users WHERE id = $1",
    [demo.rows[0].id],
  );
  const repeatedReadings = await pool.query(
    `SELECT reading_date::text AS date, slot, value
     FROM readings
     WHERE user_id = $1
     ORDER BY reading_date, slot`,
    [demo.rows[0].id],
  );
  const counts = await pool.query(
    `SELECT user_id, count(*)::int AS count
     FROM readings
     GROUP BY user_id
     ORDER BY user_id`,
  );

  expect(secondSeed.readingCount).toBe(firstSeed.readingCount);
  expect(repeatedSeed.readingCount).toBe(firstSeed.readingCount);
  expect(users.rows[0]).toEqual({
    name: "Keep This Name",
    password_hash: "keep-this-hash",
  });
  expect(repeatedReadings.rows).toEqual(firstReadings.rows);
  expect(counts.rows).toEqual([
    { user_id: demo.rows[0].id, count: firstSeed.readingCount },
    { user_id: otherUser.rows[0].id, count: 1 },
  ]);
});
