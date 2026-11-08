import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app.js";
import { config } from "../config/env.js";
import { pool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";
import { insertReading } from "../../test/helpers/readings.js";

const slots = [
  "MORNING_FASTING",
  "AFTER_BREAKFAST",
  "AFTER_LUNCH",
  "AFTER_DINNER",
];
const slotLabels = [
  "Morning (fasting)",
  "After breakfast",
  "After lunch",
  "After dinner",
];

let userAId;
let userBId;
let userAToken;

beforeAll(async () => {
  await runMigrations(pool);
});

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES
       ('User A', 'report-a@example.com', 'test-hash'),
       ('User B', 'report-b@example.com', 'test-hash')
     RETURNING id`,
  );
  [userAId, userBId] = result.rows.map((row) => row.id);
  userAToken = jwt.sign({ sub: String(userAId) }, config.jwtSecret);
});

afterAll(async () => {
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  await pool.end();
});

describe("GET /reports/daily", () => {
  test("returns daily summary and readings in slot order", async () => {
    await addReading(userAId, "2026-10-15", slots[3], 140);
    await addReading(userAId, "2026-10-15", slots[0], 100);
    await addReading(userAId, "2026-10-15", slots[2], 120);

    const response = await getReport("/reports/daily?date=2026-10-15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      from: "2026-10-15",
      to: "2026-10-15",
      count: 3,
      highest: 140,
      lowest: 100,
      average: 120,
      readings: [
        { slot: slots[0], slotLabel: slotLabels[0], value: 100 },
        { slot: slots[2], slotLabel: slotLabels[2], value: 120 },
        { slot: slots[3], slotLabel: slotLabels[3], value: 140 },
      ],
    });
  });

  test("returns the empty-state shape when there are no readings", async () => {
    const response = await getReport("/reports/daily?date=2026-10-15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      from: "2026-10-15",
      to: "2026-10-15",
      count: 0,
      highest: null,
      lowest: null,
      average: null,
      readings: [],
    });
  });
});

describe("report averages", () => {
  test("rounds 100, 101, 101 to 100.7", async () => {
    await addReading(userAId, "2026-10-15", slots[0], 100);
    await addReading(userAId, "2026-10-15", slots[1], 101);
    await addReading(userAId, "2026-10-15", slots[2], 101);

    const response = await getReport("/reports/daily?date=2026-10-15");

    expect(response.body.average).toBe(100.7);
    expect(typeof response.body.average).toBe("number");
  });

  test("uses PostgreSQL rounding for the half-tenth average of 100 and 101", async () => {
    await addReading(userAId, "2026-10-15", slots[0], 100);
    await addReading(userAId, "2026-10-15", slots[1], 101);

    const response = await getReport("/reports/daily?date=2026-10-15");

    expect(response.body.average).toBe(100.5);
  });
});

describe("GET /reports/month-to-date", () => {
  test("includes the first through requested date and ignores surrounding dates", async () => {
    await addReading(userAId, "2026-10-01", slots[0], 100);
    await addReading(userAId, "2026-10-15", slots[1], 110);
    await addReading(userAId, "2026-10-16", slots[2], 120);
    await addReading(userAId, "2026-09-30", slots[3], 130);

    const response = await getReport(
      "/reports/month-to-date?date=2026-10-15",
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-15",
      count: 2,
      highest: 110,
      lowest: 100,
      average: 105,
    });
  });
});

describe("GET /reports/monthly", () => {
  test("includes previous-month boundaries and ignores the requested month", async () => {
    await addReading(userAId, "2026-09-01", slots[0], 100);
    await addReading(userAId, "2026-09-30", slots[1], 120);
    await addReading(userAId, "2026-08-31", slots[2], 500);
    await addReading(userAId, "2026-10-01", slots[3], 600);

    const response = await getReport("/reports/monthly?date=2026-10-15");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
      count: 2,
      highest: 120,
      lowest: 100,
      average: 110,
    });
  });

  test("selects previous December for a January date", async () => {
    await addReading(userAId, "2025-12-01", slots[0], 100);
    await addReading(userAId, "2025-12-31", slots[1], 120);
    await addReading(userAId, "2026-01-01", slots[2], 600);

    const response = await getReport("/reports/monthly?date=2026-01-20");

    expect(response.body).toMatchObject({
      from: "2025-12-01",
      to: "2025-12-31",
      count: 2,
      average: 110,
    });
  });

  test.each([
    ["non-leap February", "2026-03-10", "2026-02-01", "2026-02-28"],
    ["leap February", "2024-03-10", "2024-02-01", "2024-02-29"],
  ])("handles %s", async (_scenario, date, from, to) => {
    await addReading(userAId, from, slots[0], 101);
    await addReading(userAId, to, slots[1], 103);
    await addReading(userAId, "2026-03-01", slots[2], 500);

    const response = await getReport(`/reports/monthly?date=${date}`);

    expect(response.body).toMatchObject({
      from,
      to,
      count: 2,
      average: 102,
    });
  });
});

describe("GET /reports/chart", () => {
  test("returns selected-month readings through the requested date in date and slot order", async () => {
    await addReading(userAId, "2026-10-01", slots[2], 130);
    await addReading(userAId, "2026-10-15", slots[3], 150);
    await addReading(userAId, "2026-10-15", slots[0], 95);
    await addReading(userAId, "2026-10-16", slots[1], 120);
    await addReading(userBId, "2026-10-15", slots[1], 450);

    const response = await getReport("/reports/chart?date=2026-10-15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { date: "2026-10-01", slot: slots[2], value: 130 },
      { date: "2026-10-15", slot: slots[0], value: 95 },
      { date: "2026-10-15", slot: slots[3], value: 150 },
    ]);
  });

  test.each([
    ["missing", ""],
    ["invalid calendar date", "2026-02-30"],
  ])("rejects a %s chart date", async (_scenario, date) => {
    const query = date ? `?date=${date}` : "";
    const response = await getReport(`/reports/chart${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: "date", message: "Please enter a valid date." },
    });
  });

  test("rejects a future chart date", async () => {
    const response = await getReport("/reports/chart?date=2099-12-31");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: "date", message: "Date cannot be in the future." },
    });
  });

  test("requires authentication", async () => {
    const response = await request(app)
      .get("/reports/chart?date=2026-10-15");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Please log in to continue.");
  });
});

describe("report validation and ownership", () => {
  test.each([
    ["missing", ""],
    ["invalid calendar date", "2026-02-30"],
  ])("rejects a %s report date", async (_scenario, date) => {
    const query = date ? `?date=${date}` : "";
    const response = await getReport(`/reports/daily${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: "date", message: "Please enter a valid date." },
    });
  });

  test("rejects a future report date", async () => {
    const response = await getReport("/reports/daily?date=2099-12-31");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: "date", message: "Date cannot be in the future." },
    });
  });

  test("includes only the logged-in user's readings", async () => {
    await addReading(userAId, "2026-10-15", slots[0], 100);
    await addReading(userBId, "2026-10-15", slots[1], 500);

    const response = await getReport("/reports/daily?date=2026-10-15");

    expect(response.body).toMatchObject({
      count: 1,
      highest: 100,
      lowest: 100,
      average: 100,
      readings: [{ slot: slots[0], value: 100 }],
    });
  });

  test("requires authentication", async () => {
    const response = await request(app)
      .get("/reports/daily?date=2026-10-15");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Please log in to continue.");
  });
});

async function addReading(userId, date, slot, value) {
  return insertReading({ userId, date, slot, value });
}

function getReport(path) {
  return request(app)
    .get(path)
    .set("Authorization", `Bearer ${userAToken}`);
}
