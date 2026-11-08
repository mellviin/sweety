import { pool } from "../db/pool.js";
import { config } from "../config/env.js";
import {
  firstOfMonth,
  isValidDateString,
  previousMonthRange,
  todayInTimezone,
} from "../utils/dates.js";

const slotLabels = {
  MORNING_FASTING: "Morning (fasting)",
  AFTER_BREAKFAST: "After breakfast",
  AFTER_LUNCH: "After lunch",
  AFTER_DINNER: "After dinner",
};

const slotOrder = `
  CASE slot
    WHEN 'MORNING_FASTING' THEN 1
    WHEN 'AFTER_BREAKFAST' THEN 2
    WHEN 'AFTER_LUNCH' THEN 3
    WHEN 'AFTER_DINNER' THEN 4
  END
`;

export async function getDailyReport(userId, query) {
  const date = validateReportDate(query.date);
  const summary = await getSummary(userId, date, date);
  const result = await pool.query(
    `SELECT slot, value
     FROM readings
     WHERE user_id = $1 AND reading_date >= $2 AND reading_date <= $3
     ORDER BY ${slotOrder}`,
    [userId, date, date],
  );

  return {
    ...summary,
    readings: result.rows.map((row) => ({
      slot: row.slot,
      slotLabel: slotLabels[row.slot],
      value: row.value,
    })),
  };
}

export async function getMonthToDateReport(userId, query) {
  const date = validateReportDate(query.date);
  return getSummary(userId, firstOfMonth(date), date);
}

export async function getMonthlyReport(userId, query) {
  const date = validateReportDate(query.date);
  const range = previousMonthRange(date);
  return getSummary(userId, range.startDate, range.endDate);
}

function validateReportDate(date) {
  if (!isValidDateString(date)) {
    throw reportValidationError("Please enter a valid date.");
  }

  if (date > todayInTimezone(config.appTimezone)) {
    throw reportValidationError("Date cannot be in the future.");
  }

  return date;
}

async function getSummary(userId, from, to) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS count,
       MAX(value) AS highest,
       MIN(value) AS lowest,
       ROUND(AVG(value)::numeric, 1) AS average
     FROM readings
     WHERE user_id = $1 AND reading_date >= $2 AND reading_date <= $3`,
    [userId, from, to],
  );
  const row = result.rows[0];

  return {
    from,
    to,
    count: row.count,
    highest: row.highest,
    lowest: row.lowest,
    average: row.average === null ? null : Number(row.average),
  };
}

function reportValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.field = "date";
  return error;
}
