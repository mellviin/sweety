import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { pool } from "../db/pool.js";
import { assertPasswordPolicy } from "./passwordPolicy.js";

const bcryptCost = 12;
const dummyPasswordHash = bcrypt.hash(
  randomBytes(32).toString("hex"),
  bcryptCost,
);

export async function registerUser({ name, email, password }) {
  assertPasswordPolicy(password, { name, email });
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  let result;

  try {
    result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, token_version`,
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
    `SELECT id, name, email, password_hash, token_version
     FROM users
     WHERE email = $1`,
    [email],
  );
  const user = result.rows[0];
  const hash = user?.password_hash ?? await dummyPasswordHash;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (
    !user
    || !passwordMatches
    || Buffer.byteLength(password, "utf8") > 72
  ) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    error.field = null;
    throw error;
  }

  return createAuthenticatedUser({
    id: user.id,
    name: user.name,
    email: user.email,
  }, user.token_version);
}

export async function getUserById(userId) {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function logoutUser(userId) {
  await pool.query(
    "UPDATE users SET token_version = token_version + 1 WHERE id = $1",
    [userId],
  );
}

export async function changeUserPassword(
  userId,
  { currentPassword, newPassword },
) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const result = await client.query(
      `SELECT id, name, email, password_hash, token_version
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw createInvalidCredentials();
    }

    assertPasswordPolicy(
      newPassword,
      { name: user.name, email: user.email },
      "newPassword",
    );

    const passwordHash = await bcrypt.hash(newPassword, bcryptCost);
    const updated = await client.query(
      `UPDATE users
       SET password_hash = $2, token_version = token_version + 1
       WHERE id = $1
       RETURNING id, name, email, token_version`,
      [userId, passwordHash],
    );
    await client.query("COMMIT");
    transactionStarted = false;

    const updatedUser = updated.rows[0];
    return {
      token: createToken(updatedUser, updatedUser.token_version),
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

function createAuthenticatedUser(user, tokenVersion = user.token_version) {
  return {
    token: createToken(user, tokenVersion),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

function createToken(user, tokenVersion) {
  return jwt.sign(
    { sub: String(user.id), tv: tokenVersion },
    config.jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: config.jwtExpiresIn,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    },
  );
}

function createEmailConflict() {
  const error = new Error("An account with this email already exists.");
  error.status = 409;
  error.field = "email";
  return error;
}

function createInvalidCredentials() {
  const error = new Error("Invalid email or password.");
  error.status = 401;
  error.field = null;
  return error;
}
