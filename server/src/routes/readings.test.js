import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app.js";
import { config } from "../config/env.js";
import { getMigrationPool, pool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";
import { todayInTimezone } from "../utils/dates.js";

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

let userAToken;
let userBToken;
let today;

beforeAll(async () => {
  await runMigrations(getMigrationPool());
});

beforeEach(async () => {
  await getMigrationPool().query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  const users = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES
       ('User A', 'user-a@example.com', 'test-hash'),
       ('User B', 'user-b@example.com', 'test-hash')
     RETURNING id`,
  );
  userAToken = createTestToken(users.rows[0].id);
  userBToken = createTestToken(users.rows[1].id);
  today = todayInTimezone(config.appTimezone);
});

afterAll(async () => {
  await getMigrationPool().query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  await pool.end();
  await getMigrationPool().end();
});

describe("POST /readings", () => {
  test("write limits apply per authenticated user and return Retry-After", async () => {
    const previousEnabled = config.rateLimitsEnabled;
    const previousLimit = config.readingWriteRateLimitMax;
    config.rateLimitsEnabled = true;
    config.readingWriteRateLimitMax = 1;

    try {
      const firstUserWrite = await createReading({
        date: today,
        slot: slots[0],
        value: 120,
      });
      const secondUserWrite = await createReading({
        date: today,
        slot: slots[0],
        value: 121,
      }, userBToken);
      const limitedUserWrite = await createReading({
        date: today,
        slot: slots[1],
        value: 122,
      });

      expect(firstUserWrite.status).toBe(201);
      expect(secondUserWrite.status).toBe(201);
      expect(limitedUserWrite.status).toBe(429);
      expect(limitedUserWrite.headers["retry-after"]).toMatch(/^\d+$/);
      expect(limitedUserWrite.body.error.field).toBeNull();
    } finally {
      config.rateLimitsEnabled = previousEnabled;
      config.readingWriteRateLimitMax = previousLimit;
    }
  });

  test("creates a reading with the specified response shape", async () => {
    const response = await createReading({
      date: today,
      slot: slots[0],
      value: 120,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 1,
      date: today,
      slot: slots[0],
      slotLabel: slotLabels[0],
      value: 120,
    });
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.updatedAt).toEqual(expect.any(String));
  });

  test("rejects a missing glucose value", async () => {
    const response = await createReading({ date: today, slot: slots[0] });

    expectValidation(response, 400, "value", "Please enter a glucose value.");
  });

  test.each([["empty", ""], ["null", null]])(
    "rejects an %s glucose value",
    async (_scenario, value) => {
      const response = await createReading({ date: today, slot: slots[0], value });

      expectValidation(response, 400, "value", "Please enter a glucose value.");
    },
  );

  test.each([
    ["39", 39],
    ["601", 601],
    ["fractional", 120.5],
    ["non-numeric", "abc"],
  ])("rejects %s glucose values", async (_scenario, value) => {
    const response = await createReading({ date: today, slot: slots[0], value });

    expectValidation(response, 400, "value", "Value must be between 40 and 600 mg/dl.");
  });

  test.each([40, 600])("accepts boundary value %s", async (value) => {
    const response = await createReading({ date: today, slot: slots[0], value });

    expect(response.status).toBe(201);
    expect(response.body.value).toBe(value);
  });

  test("accepts a numeric string value", async () => {
    const response = await createReading({
      date: today,
      slot: slots[0],
      value: "120",
    });

    expect(response.status).toBe(201);
    expect(response.body.value).toBe(120);
  });

  test("rejects a missing slot", async () => {
    const response = await createReading({ date: today, value: 120 });

    expectValidation(response, 400, "slot", "Please select a time slot.");
  });

  test("rejects an invalid slot", async () => {
    const response = await createReading({
      date: today,
      slot: "BEDTIME",
      value: 120,
    });

    expectValidation(response, 400, "slot", "Please select a time slot.");
  });

  test("rejects a missing or invalid calendar date", async () => {
    const missing = await createReading({ slot: slots[0], value: 120 });
    const invalid = await createReading({
      date: "2026-02-30",
      slot: slots[0],
      value: 120,
    });

    expectValidation(missing, 400, "date", "Please enter a valid date.");
    expectValidation(invalid, 400, "date", "Please enter a valid date.");
  });

  test("rejects a future date in the configured timezone", async () => {
    const response = await createReading({
      date: nextDate(today),
      slot: slots[0],
      value: 120,
    });

    expectValidation(response, 400, "date", "Date cannot be in the future.");
  });

  test("allows today's date in the configured timezone", async () => {
    const response = await createReading({
      date: today,
      slot: slots[0],
      value: 120,
    });

    expect(response.status).toBe(201);
  });

  test("rejects a duplicate slot on the same date", async () => {
    await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await createReading({
      date: today,
      slot: slots[0],
      value: 130,
    });

    expectValidation(
      response,
      409,
      "slot",
      "You already have a Morning (fasting) reading for this date.",
    );
  });

  test("allows the same slot on a different date", async () => {
    await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await createReading({
      date: previousDate(today),
      slot: slots[0],
      value: 130,
    });

    expect(response.status).toBe(201);
  });

  test("allows the same slot and date for a different user", async () => {
    await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await createReading(
      { date: today, slot: slots[0], value: 130 },
      userBToken,
    );

    expect(response.status).toBe(201);
  });

  test("checks the four-reading maximum before duplicate slots", async () => {
    for (const slot of slots) {
      await createReading({ date: today, slot, value: 120 });
    }

    const response = await createReading({
      date: today,
      slot: slots[0],
      value: 130,
    });

    expectValidation(response, 409, "date", "You can add only 4 readings per day.");
  });
});

describe("GET /readings", () => {
  test("returns pagination metadata and orders readings by date and slot", async () => {
    await createReading({ date: previousDate(today), slot: slots[0], value: 101 });
    await createReading({ date: today, slot: slots[2], value: 102 });
    await createReading({ date: today, slot: slots[0], value: 103 });

    const response = await request(app)
      .get("/readings?page=2&limit=2")
      .set(authHeader());
    const firstPage = await request(app)
      .get("/readings?page=1&limit=2")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      date: previousDate(today),
      slot: slots[0],
      value: 101,
    });
    expect(firstPage.body.data.map((reading) => reading.slot)).toEqual([
      slots[0],
      slots[2],
    ]);
  });

  test("filters by date and rejects invalid pagination parameters", async () => {
    await createReading({ date: today, slot: slots[0], value: 101 });
    await createReading({ date: previousDate(today), slot: slots[0], value: 102 });
    const filtered = await request(app)
      .get(`/readings?date=${today}`)
      .set(authHeader());
    const badPage = await request(app).get("/readings?page=0").set(authHeader());
    const badLimit = await request(app).get("/readings?limit=101").set(authHeader());

    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.data[0].date).toBe(today);
    expect(badPage.status).toBe(400);
    expect(badPage.body.error.field).toBe("page");
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.error.field).toBe("limit");
  });

  test("does not include another user's readings", async () => {
    await createReading({ date: today, slot: slots[0], value: 101 });
    await createReading(
      { date: today, slot: slots[1], value: 102 },
      userBToken,
    );
    const response = await request(app)
      .get("/readings")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data.map((reading) => reading.value)).toEqual([101]);
  });

  test("requires authentication", async () => {
    const response = await request(app).get("/readings");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Please log in to continue.");
  });
});

describe("reading ownership and updates", () => {
  test("allows reading's owner to fetch a reading", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await request(app)
      .get(`/readings/${created.body.id}`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.body.id);
  });

  test("does not allow another user to read a reading", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await request(app)
      .get(`/readings/${created.body.id}`)
      .set(authHeader(userBToken));

    expectNotFound(response);
  });

  test("does not allow another user to edit a reading", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await request(app)
      .put(`/readings/${created.body.id}`)
      .set(authHeader(userBToken))
      .send({ date: today, slot: slots[0], value: 130 });

    expectNotFound(response);
  });

  test("does not allow another user to delete a reading", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await request(app)
      .delete(`/readings/${created.body.id}`)
      .set(authHeader(userBToken));

    expectNotFound(response);
  });

  test("returns 404 for a non-existent reading", async () => {
    const response = await request(app)
      .get("/readings/999")
      .set(authHeader());

    expectNotFound(response);
  });

  test("edits a reading without treating its own slot as a duplicate", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const response = await request(app)
      .put(`/readings/${created.body.id}`)
      .set(authHeader())
      .send({ date: today, slot: slots[0], value: 140 });

    expect(response.status).toBe(200);
    expect(response.body.value).toBe(140);
    expect(new Date(response.body.updatedAt).getTime())
      .toBeGreaterThanOrEqual(new Date(created.body.updatedAt).getTime());
  });

  test("rejects editing to a slot already used on that date", async () => {
    await createReading({ date: today, slot: slots[0], value: 120 });
    const second = await createReading({ date: today, slot: slots[1], value: 130 });
    const response = await request(app)
      .put(`/readings/${second.body.id}`)
      .set(authHeader())
      .send({ date: today, slot: slots[0], value: 140 });

    expectValidation(
      response,
      409,
      "slot",
      "You already have a Morning (fasting) reading for this date.",
    );
  });

  test("allows an edit that makes the destination date have four readings", async () => {
    const moved = await createReading({
      date: previousDate(today),
      slot: slots[0],
      value: 120,
    });
    for (const slot of slots.slice(0, 3)) {
      await createReading({ date: today, slot, value: 130 });
    }

    const response = await request(app)
      .put(`/readings/${moved.body.id}`)
      .set(authHeader())
      .send({ date: today, slot: slots[3], value: 140 });

    expect(response.status).toBe(200);
    expect(response.body.date).toBe(today);
    expect(response.body.slot).toBe(slots[3]);
  });
});

describe("DELETE /readings/:id", () => {
  test("deletes a reading and frees its slot", async () => {
    const created = await createReading({ date: today, slot: slots[0], value: 120 });
    const deleted = await request(app)
      .delete(`/readings/${created.body.id}`)
      .set(authHeader());
    const replacement = await createReading({
      date: today,
      slot: slots[0],
      value: 140,
    });

    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    expect(replacement.status).toBe(201);
  });
});

function authHeader(token = userAToken) {
  return { Authorization: `Bearer ${token}` };
}

function createTestToken(userId) {
  return jwt.sign(
    { sub: String(userId), tv: 0 },
    config.jwtSecret,
    {
      algorithm: "HS256",
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    },
  );
}

function createReading(reading, token = userAToken) {
  return request(app)
    .post("/readings")
    .set(authHeader(token))
    .send(reading);
}

function expectValidation(response, status, field, message) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ error: { field, message } });
}

function expectNotFound(response) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ error: { message: "Reading not found." } });
}

function nextDate(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  const day = Number(dateString.slice(8, 10));
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  if (day < daysInMonth) {
    return `${dateString.slice(0, 8)}${String(day + 1).padStart(2, "0")}`;
  }

  if (month < 12) {
    return `${dateString.slice(0, 4)}-${String(month + 1).padStart(2, "0")}-01`;
  }

  return `${String(year + 1).padStart(4, "0")}-01-01`;
}

function previousDate(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  const day = Number(dateString.slice(8, 10));

  if (day > 1) {
    return `${dateString.slice(0, 8)}${String(day - 1).padStart(2, "0")}`;
  }

  if (month > 1) {
    const previousMonth = month - 1;
    const previousMonthDays = [
      31,
      isLeapYear(year) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][previousMonth - 1];
    return `${dateString.slice(0, 4)}-${String(previousMonth).padStart(2, "0")}-${previousMonthDays}`;
  }

  return `${String(year - 1).padStart(4, "0")}-12-31`;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
