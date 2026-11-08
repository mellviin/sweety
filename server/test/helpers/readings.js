import { pool } from "../../src/db/pool.js";

export async function insertReading({
  userId,
  date,
  slot,
  value,
}) {
  const result = await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, value)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, date, slot, value],
  );

  return result.rows[0].id;
}
