import bcrypt from "bcrypt";
import { fileURLToPath } from "node:url";
import { config } from "../config/env.js";
import { pool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import {
  previousMonthRange,
  todayInTimezone,
} from "../utils/dates.js";

const demoUser = {
  name: "Demo User",
  email: "demo@sweety.test",
  password: "Demo@1234",
};
const slots = [
  "MORNING_FASTING",
  "AFTER_BREAKFAST",
  "AFTER_LUNCH",
  "AFTER_DINNER",
];
const slotRanges = [
  [80, 130],
  [110, 220],
  [110, 220],
  [110, 220],
];

export async function seedDemoData(database = pool) {
  await runMigrations(database);

  const yesterday = shiftDate(todayInTimezone(config.appTimezone), -1);
  const recentDates = Array.from({ length: 21 }, (_value, index) =>
    shiftDate(yesterday, index - 20));
  const previousMonth = previousMonthRange(yesterday);
  const previousMonthDates = [previousMonth.endDate];
  const dayCounts = new Map(
    recentDates.map((date, index) => [date, readingsPerDay(index)]),
  );

  for (const [index, date] of previousMonthDates.entries()) {
    if (!dayCounts.has(date)) {
      dayCounts.set(date, [4, 2, 3][index]);
    }
  }

  const dates = [...dayCounts.keys()].sort();
  const random = createSeededRandom(0x5eed1234);
  const seededReadings = [];

  for (const date of dates) {
    const dateIndex = recentDates.indexOf(date);
    const readingCount = dayCounts.get(date);

    for (let slotIndex = 0; slotIndex < readingCount; slotIndex += 1) {
      seededReadings.push({
        date,
        slot: slots[slotIndex],
        value: glucoseValue({
          slotIndex,
          dateIndex,
          random,
        }),
      });
    }
  }

  const readingDates = [...new Set(seededReadings.map((reading) => reading.date))].sort();
  const passwordHash = await bcrypt.hash(demoUser.password, 12);
  const client = await database.connect();

  try {
    await client.query("BEGIN");

    let userResult = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [demoUser.name, demoUser.email, passwordHash],
    );

    if (userResult.rowCount === 0) {
      userResult = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [demoUser.email],
      );
    }

    const userId = userResult.rows[0].id;
    await client.query("DELETE FROM readings WHERE user_id = $1", [userId]);

    if (seededReadings.length > 0) {
      const values = [];
      const placeholders = seededReadings.map((reading, index) => {
        const parameter = index * 4;
        values.push(userId, reading.date, reading.slot, reading.value);
        return `($${parameter + 1}, $${parameter + 2}, $${parameter + 3}, $${parameter + 4})`;
      });

      await client.query(
        `INSERT INTO readings (user_id, reading_date, slot, value)
         VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    await client.query("COMMIT");

    return {
      readingCount: seededReadings.length,
      from: readingDates[0],
      to: readingDates[readingDates.length - 1],
      ...demoUser,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function shiftDate(dateString, dayOffset) {
  let year = Number(dateString.slice(0, 4));
  let month = Number(dateString.slice(5, 7));
  let day = Number(dateString.slice(8, 10));
  let remaining = dayOffset;

  while (remaining > 0) {
    if (day < daysInMonth(year, month)) {
      day += 1;
    } else {
      day = 1;
      if (month === 12) {
        month = 1;
        year += 1;
      } else {
        month += 1;
      }
    }
    remaining -= 1;
  }

  while (remaining < 0) {
    if (day > 1) {
      day -= 1;
    } else if (month === 1) {
      month = 12;
      year -= 1;
      day = daysInMonth(year, month);
    } else {
      month -= 1;
      day = daysInMonth(year, month);
    }
    remaining += 1;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [
    31,
    leapYear ? 29 : 28,
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
}

function readingsPerDay(index) {
  return [0, 1, 2, 3, 4, 4, 4][index % 7];
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function glucoseValue({ slotIndex, dateIndex, random }) {
  if (dateIndex === 3 && slotIndex === 0) {
    return 58;
  }

  if (dateIndex === 12 && slotIndex === 2) {
    return 258;
  }

  const [minimum, maximum] = slotRanges[slotIndex];
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await seedDemoData();
    console.info(
      `Seeded ${result.readingCount} readings from ${result.from} to ${result.to}.`,
    );
    console.info(`Demo login: ${result.email} / ${result.password}`);
  } catch (error) {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
