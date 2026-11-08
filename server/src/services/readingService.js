import { pool } from "../db/pool.js";
import { config } from "../config/env.js";
import { isValidDateString, todayInTimezone } from "../utils/dates.js";

const slotLabels = {
  MORNING_FASTING: "Morning (fasting)",
  AFTER_BREAKFAST: "After breakfast",
  AFTER_LUNCH: "After lunch",
  AFTER_DINNER: "After dinner",
};

const slots = Object.keys(slotLabels);

const readingColumns = `
  id,
  reading_date,
  slot,
  value,
  created_at,
  updated_at
`;

export async function createReading(userId, input) {
  const reading = validateReadingInput(input);
  await validateDateConflicts(userId, reading.date, reading.slot);

  try {
    const result = await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING ${readingColumns}`,
      [userId, reading.date, reading.slot, reading.value],
    );

    return formatReading(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw duplicateSlotError(reading.slot);
    }

    throw error;
  }
}

export async function listReadings(userId, query) {
  const { date, page, limit } = validateListQuery(query);
  const parameters = [userId];
  let dateFilter = "";

  if (date !== undefined) {
    parameters.push(date);
    dateFilter = ` AND reading_date = $${parameters.length}`;
  }

  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM readings
     WHERE user_id = $1${dateFilter}`,
    parameters,
  );
  const total = countResult.rows[0].total;
  const offset = (page - 1) * limit;
  const result = await pool.query(
    `SELECT ${readingColumns}
     FROM readings
     WHERE user_id = $1${dateFilter}
     ORDER BY reading_date DESC,
       CASE slot
         WHEN 'MORNING_FASTING' THEN 1
         WHEN 'AFTER_BREAKFAST' THEN 2
         WHEN 'AFTER_LUNCH' THEN 3
         WHEN 'AFTER_DINNER' THEN 4
       END
     LIMIT $${parameters.length + 1}
     OFFSET $${parameters.length + 2}`,
    [...parameters, limit, offset],
  );

  return {
    data: result.rows.map(formatReading),
    page,
    limit,
    total,
  };
}

export async function getReading(userId, readingId) {
  const id = parseReadingId(readingId);
  const result = await pool.query(
    `SELECT ${readingColumns}
     FROM readings
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (!result.rows[0]) {
    throw readingNotFoundError();
  }

  return formatReading(result.rows[0]);
}

export async function updateReading(userId, readingId, input) {
  const id = parseReadingId(readingId);
  await ensureReadingExists(userId, id);

  const reading = validateReadingInput(input);
  await validateDateConflicts(userId, reading.date, reading.slot, id);

  try {
    const result = await pool.query(
      `UPDATE readings
       SET reading_date = $1, slot = $2, value = $3, updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING ${readingColumns}`,
      [reading.date, reading.slot, reading.value, id, userId],
    );

    if (!result.rows[0]) {
      throw readingNotFoundError();
    }

    return formatReading(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw duplicateSlotError(reading.slot);
    }

    throw error;
  }
}

export async function deleteReading(userId, readingId) {
  const id = parseReadingId(readingId);
  const result = await pool.query(
    "DELETE FROM readings WHERE id = $1 AND user_id = $2",
    [id, userId],
  );

  if (result.rowCount === 0) {
    throw readingNotFoundError();
  }
}

function validateReadingInput(input = {}) {
  const { value, slot, date } = input && typeof input === "object" ? input : {};

  if (value === undefined || value === null || value === "") {
    throw validationError("value", "Please enter a glucose value.");
  }

  const parsedValue = parseGlucoseValue(value);
  if (parsedValue === null || parsedValue < 40 || parsedValue > 600) {
    throw validationError("value", "Value must be between 40 and 600 mg/dl.");
  }

  if (typeof slot !== "string" || !slots.includes(slot)) {
    throw validationError("slot", "Please select a time slot.");
  }

  if (!isValidDateString(date)) {
    throw validationError("date", "Please enter a valid date.");
  }

  if (date > todayInTimezone(config.appTimezone)) {
    throw validationError("date", "Date cannot be in the future.");
  }

  return { date, slot, value: parsedValue };
}

function parseGlucoseValue(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateListQuery(query = {}) {
  const date = query.date;
  if (date !== undefined && !isValidDateString(date)) {
    throw validationError("date", "Please enter a valid date.");
  }

  const page = parsePositiveInteger(query.page, 1);
  if (page === null) {
    throw validationError("page", "Page must be a whole number greater than or equal to 1.");
  }

  const limit = parsePositiveInteger(query.limit, 20);
  if (limit === null || limit > 100) {
    throw validationError("limit", "Limit must be a whole number between 1 and 100.");
  }

  return { date, page, limit };
}

function parsePositiveInteger(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

async function validateDateConflicts(userId, date, slot, excludedId) {
  const idFilter = excludedId === undefined ? "" : " AND id <> $3";
  const parameters = excludedId === undefined
    ? [userId, date]
    : [userId, date, excludedId];
  const countResult = await pool.query(
    `SELECT count(*)::int AS total
     FROM readings
     WHERE user_id = $1 AND reading_date = $2${idFilter}`,
    parameters,
  );

  if (countResult.rows[0].total >= 4) {
    throw validationError("date", "You can add only 4 readings per day.", 409);
  }

  const duplicateResult = await pool.query(
    `SELECT 1
     FROM readings
     WHERE user_id = $1 AND reading_date = $2 AND slot = $3
       ${excludedId === undefined ? "" : "AND id <> $4"}
     LIMIT 1`,
    excludedId === undefined
      ? [userId, date, slot]
      : [userId, date, slot, excludedId],
  );

  if (duplicateResult.rowCount > 0) {
    throw duplicateSlotError(slot);
  }
}

async function ensureReadingExists(userId, id) {
  const result = await pool.query(
    "SELECT 1 FROM readings WHERE id = $1 AND user_id = $2",
    [id, userId],
  );

  if (result.rowCount === 0) {
    throw readingNotFoundError();
  }
}

function formatReading(row) {
  return {
    id: row.id,
    date: row.reading_date,
    slot: row.slot,
    slotLabel: slotLabels[row.slot],
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseReadingId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw readingNotFoundError();
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw readingNotFoundError();
  }

  return id;
}

function validationError(field, message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.field = field;
  return error;
}

function duplicateSlotError(slot) {
  return validationError(
    "slot",
    `You already have a ${slotLabels[slot]} reading for this date.`,
    409,
  );
}

function readingNotFoundError() {
  const error = new Error("Reading not found.");
  error.status = 404;
  error.omitField = true;
  return error;
}
