import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { pool } from "../db/pool.js";

const bcryptCost = 12;

export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  let result;

  try {
    result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash],
    );
  } catch (error) {
    if (error.code === "23505") {
      throw createEmailConflict();
    }

    throw error;
  }

  return createAuthenticatedUser(result.rows[0]);
}

export async function loginUser({ email, password }) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE email = $1`,
    [email],
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    error.field = null;
    throw error;
  }

  return createAuthenticatedUser({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}

export async function getUserById(userId) {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [userId],
  );

  return result.rows[0] ?? null;
}

function createAuthenticatedUser(user) {
  return {
    token: jwt.sign(
      { sub: String(user.id) },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    ),
    user,
  };
}

function createEmailConflict() {
  const error = new Error("An account with this email already exists.");
  error.status = 409;
  error.field = "email";
  return error;
}
