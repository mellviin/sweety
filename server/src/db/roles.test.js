import { migrationPool, pool } from "./pool.js";
import { runMigrations } from "./migrate.js";

beforeAll(async () => {
  await runMigrations(migrationPool);
});

afterAll(async () => {
  await pool.end();
  await migrationPool.end();
});

test("the app database role cannot perform administrative actions", async () => {
  const client = await pool.connect();

  try {
    const { rows } = await client.query("SELECT current_user");
    expect(rows[0].current_user).toBe("sweety_app");

    await expect(client.query("DROP TABLE readings")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(client.query("CREATE ROLE sweety_test_escalation")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(client.query("SELECT count(*) FROM pg_shadow"))
      .rejects.toMatchObject({ code: "42501" });
  } finally {
    client.release();
  }
});

test("database pools have bounded resources and statement timeouts", () => {
  expect(pool.options).toMatchObject({
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
});

test("the test migration pool targets the test database with migration credentials", () => {
  const migrationUrl = new URL(migrationPool.options.connectionString);
  expect(migrationUrl.pathname).toBe("/sweety_test");
  expect(migrationUrl.username).toBe("sweety_migrate");
});

test("the app role is limited to valid CRUD operations and cascading deletes", async () => {
  const client = await pool.connect();
  let userId;

  try {
    const email = `security-${process.pid}-${Date.now()}@example.test`;
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Security Test', $1, 'test-hash')
       RETURNING id`,
      [email],
    );
    userId = rows[0].id;

    await expect(client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Duplicate', $1, 'test-hash')`,
      [email.toUpperCase()],
    )).rejects.toMatchObject({ code: "23505" });
    await expect(client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, '2026-01-01', 'MORNING_FASTING', 39)`,
      [userId],
    )).rejects.toMatchObject({ code: "23514" });
    await expect(client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, '2026-01-01', 'INVALID_SLOT', 100)`,
      [userId],
    )).rejects.toMatchObject({ code: "23514" });
    await expect(client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, '2026-01-01', 'AFTER_BREAKFAST', NULL)`,
      [userId],
    )).rejects.toMatchObject({ code: "23502" });

    await client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, '2026-01-01', 'MORNING_FASTING', 100)`,
      [userId],
    );
    await expect(client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, '2026-01-01', 'MORNING_FASTING', 110)`,
      [userId],
    )).rejects.toMatchObject({ code: "23505" });

    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    const deletedReadings = await client.query(
      "SELECT count(*)::int AS count FROM readings WHERE user_id = $1",
      [userId],
    );
    expect(deletedReadings.rows[0].count).toBe(0);
    userId = undefined;
  } finally {
    if (userId !== undefined) {
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    client.release();
  }
});
