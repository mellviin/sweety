import bcrypt from "bcrypt";
import request from "supertest";
import app from "../app.js";
import { config } from "../config/env.js";
import { getMigrationPool, pool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";

const userInput = {
  name: "  Sweety User  ",
  email: "  Sweety.User@Example.COM  ",
  password: "correct-horse-battery",
};

beforeAll(async () => {
  await runMigrations(getMigrationPool());
});

beforeEach(async () => {
  await getMigrationPool().query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
  await getMigrationPool().end();
});

describe("POST /auth/register", () => {
  test("registers a normalized user and returns a usable token", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send(userInput);

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: 1,
      name: "Sweety User",
      email: "sweety.user@example.com",
    });
    expect(typeof response.body.token).toBe("string");

    const currentUser = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${response.body.token}`);
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user).toEqual(response.body.user);
  });

  test("stores a bcrypt hash rather than the submitted password", async () => {
    await request(app).post("/auth/register").send(userInput);
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE email = $1",
      ["sweety.user@example.com"],
    );
    const [storedHash] = result.rows;

    expect(storedHash.password_hash).not.toBe(userInput.password);
    expect(await bcrypt.compare(userInput.password, storedHash.password_hash)).toBe(true);
  });

  test("returns 409 when the email already exists", async () => {
    await request(app).post("/auth/register").send(userInput);
    const response = await request(app)
      .post("/auth/register")
      .send({ ...userInput, name: "Another User" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        field: "email",
        message: "An account with this email already exists.",
      },
    });
  });

  test("rejects an invalid email and a short password", async () => {
    const invalidEmail = await request(app)
      .post("/auth/register")
      .send({ ...userInput, email: "not-an-email" });
    const shortPassword = await request(app)
      .post("/auth/register")
      .send({ ...userInput, password: "short" });

    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body.error.field).toBe("email");
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.field).toBe("password");
  });

  test("rejects blank and overlong names", async () => {
    const blankName = await request(app)
      .post("/auth/register")
      .send({ ...userInput, name: "   " });
    const longName = await request(app)
      .post("/auth/register")
      .send({ ...userInput, name: "a".repeat(101) });

    expect(blankName.status).toBe(400);
    expect(blankName.body.error.field).toBe("name");
    expect(longName.status).toBe(400);
    expect(longName.body.error.field).toBe("name");
  });

  test("never includes password_hash in authentication responses", async () => {
    const registration = await request(app)
      .post("/auth/register")
      .send(userInput);
    const login = await request(app)
      .post("/auth/login")
      .send({ email: userInput.email, password: userInput.password });
    const currentUser = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${registration.body.token}`);

    for (const response of [registration, login, currentUser]) {
      expect(JSON.stringify(response.body)).not.toContain("password_hash");
    }
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/register").send(userInput);
  });

  test("logs in with a case-insensitive email and correct password", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "SWEETY.USER@example.com", password: userInput.password });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 1,
      name: "Sweety User",
      email: "sweety.user@example.com",
    });
    expect(typeof response.body.token).toBe("string");
  });

  test.each([
    ["wrong password", "different-password"],
    ["unknown email", "unknown@example.com"],
  ])("returns the same unauthorized response for %s", async (_scenario, emailOrPassword) => {
    const credentials = emailOrPassword.includes("@")
      ? { email: emailOrPassword, password: userInput.password }
      : { email: userInput.email, password: emailOrPassword };
    const response = await request(app).post("/auth/login").send(credentials);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { field: null, message: "Invalid email or password." },
    });
  });

  describe("rate limiting", () => {
    const originalRateLimitEnabled = config.rateLimitsEnabled;
    const originalAuthLimit = config.authRateLimitMax;
    const originalFailureLimit = config.loginFailureRateLimitMax;
    const originalFailureWindow = config.loginFailureRateLimitWindowMs;

    beforeAll(() => {
      config.rateLimitsEnabled = true;
      config.loginFailureRateLimitMax = 5;
      config.loginFailureRateLimitWindowMs = 500;
    });

    afterAll(() => {
      config.rateLimitsEnabled = originalRateLimitEnabled;
      config.authRateLimitMax = originalAuthLimit;
      config.loginFailureRateLimitMax = originalFailureLimit;
      config.loginFailureRateLimitWindowMs = originalFailureWindow;
    });

    test("the sixth failed login is limited, but another email is unaffected", async () => {
      const email = `blocked-${Date.now()}@example.com`;
      const failures = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        failures.push(await request(app)
          .post("/auth/login")
          .send({ email, password: "wrong-password" }));
      }

      const blocked = await request(app)
        .post("/auth/login")
        .send({ email, password: "wrong-password" });
      const otherEmail = await request(app)
        .post("/auth/login")
        .send({ email: `other-${Date.now()}@example.com`, password: "wrong-password" });

      expect(failures.map(({ status }) => status)).toEqual([401, 401, 401, 401, 401]);
      expect(failures[0].body).toEqual({
        error: { field: null, message: "Invalid email or password." },
      });
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toMatch(/^\d+$/);
      expect(blocked.body.error.message).toBe(
        "Too many requests. Please try again later.",
      );
      expect(otherEmail.status).toBe(401);
      expect(otherEmail.body.error.message).toBe("Invalid email or password.");
    });

    test("failed-login limit resets after its configured window", async () => {
      const email = `reset-${Date.now()}@example.com`;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request(app)
          .post("/auth/login")
          .send({ email, password: "wrong-password" });
        expect(response.status).toBe(401);
      }

      await new Promise((resolve) => setTimeout(resolve, 525));

      const afterWindow = await request(app)
        .post("/auth/login")
        .send({ email, password: "wrong-password" });
      expect(afterWindow.status).toBe(401);
      expect(afterWindow.body.error.message).toBe("Invalid email or password.");
    });

    test("the auth endpoint limiter has a configurable limit in test mode", async () => {
      const previousTrustProxy = app.get("trust proxy");
      config.authRateLimitMax = 2;
      app.set("trust proxy", 1);
      const clientIp = "192.0.2.42";
      const email = `auth-limit-${Date.now()}@example.com`;
      try {
        const first = await request(app)
          .post("/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email, password: "wrong-password" });
        const second = await request(app)
          .post("/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: `auth-second-${Date.now()}@example.com`, password: "wrong-password" });
        const limited = await request(app)
          .post("/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: `auth-third-${Date.now()}@example.com`, password: "wrong-password" });

        expect(first.status).toBe(401);
        expect(second.status).toBe(401);
        expect(limited.status).toBe(429);
        expect(limited.headers["retry-after"]).toMatch(/^\d+$/);
      } finally {
        app.set("trust proxy", previousTrustProxy);
      }
    });
  });
});

describe("GET /auth/me", () => {
  test.each([undefined, "garbage-token"])(
    "rejects a missing or invalid token",
    async (token) => {
      const requestBuilder = request(app).get("/auth/me");
      if (token) {
        requestBuilder.set("Authorization", `Bearer ${token}`);
      }

      const response = await requestBuilder;
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { field: null, message: "Please log in to continue." },
      });
    },
  );
});
