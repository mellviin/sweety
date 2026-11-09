import bcrypt from "bcrypt";
import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
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
    expect(bcrypt.getRounds(storedHash.password_hash)).toBe(12);
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

  test.each([
    ["common", "password", "Choose a less common password."],
    ["over 72 characters", "a".repeat(73), "Password must be no more than 72 characters."],
    ["matching the email", "sweety.user@example.com", "Password must not match your email or name."],
    ["matching the name", "Sweety User", "Password must not match your email or name."],
  ])("rejects a %s password", async (_scenario, password, message) => {
    const response = await request(app)
      .post("/auth/register")
      .send({ ...userInput, password });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({ field: "password", message });
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

  test("rejects 51 malformed registration payloads without server errors", async () => {
    for (let index = 0; index < 51; index += 1) {
      const response = await request(app)
        .post("/auth/register")
        .send({
          name: { malformed: index },
          email: [index],
          password: { value: index },
        });

      expect(response.status).toBe(400);
    }
  });

  test("rejects extra registration fields", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({ ...userInput, role: "admin" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Please enter a valid request.");
  });

  test("rejects a 10,000-character email before validation regexes run", async () => {
    const startedAt = performance.now();
    const response = await request(app)
      .post("/auth/register")
      .send({ ...userInput, email: `${"a".repeat(10_000)}@example.com` });
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(400);
    expect(elapsedMs).toBeLessThan(100);
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
  let registration;

  beforeEach(async () => {
    registration = await request(app).post("/auth/register").send(userInput);
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

  test("login success logs never contain the password or issued token", async () => {
    const loggedLines = [];
    const write = jest.spyOn(process.stdout, "write")
      .mockImplementation((line) => {
        loggedLines.push(String(line));
        return true;
      });

    try {
      const response = await request(app)
        .post("/auth/login")
        .send({ email: userInput.email, password: userInput.password });
      const output = loggedLines.join("");

      expect(response.status).toBe(200);
      expect(output).not.toContain(userInput.password);
      expect(output).not.toContain(response.body.token);
      expect(output).toContain("s***@example.com");
    } finally {
      write.mockRestore();
    }
  });

  test("a failed login records a security event without credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .set("X-Request-Id", "failed-login-event")
      .set("User-Agent", "Security test agent")
      .send({ email: userInput.email, password: "wrong-password" });
    const result = await pool.query(
      `SELECT event_type, user_id, ip, user_agent
       FROM security_events
       WHERE event_type = 'login_failed'
       ORDER BY created_at DESC
       LIMIT 1`,
    );

    expect(response.status).toBe(401);
    expect(result.rows[0]).toMatchObject({
      event_type: "login_failed",
      user_id: null,
      ip: expect.any(String),
      user_agent: "Security test agent",
    });
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

  test("unknown email and wrong password have identical responses", async () => {
      const wrongPassword = await request(app)
        .post("/auth/login")
        .send({ email: userInput.email, password: "wrong-password" });
      const unknownEmail = await request(app)
        .post("/auth/login")
        .send({ email: "unknown@example.com", password: "wrong-password" });

      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(unknownEmail.body).toEqual({
        error: { field: null, message: "Invalid email or password." },
      });
    });

  test("only accepts HS256 tokens with the configured claims and current version", async () => {
      const userId = registration.body.user.id;
      const claims = { sub: String(userId), tv: 0 };
      const validOptions = {
        algorithm: "HS256",
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      };
      const tampered = registration.body.token.split(".");
      tampered[1] = Buffer.from(JSON.stringify({
        sub: String(userId + 1),
        tv: 0,
        iss: config.jwtIssuer,
        aud: config.jwtAudience,
        iat: Math.floor(Date.now() / 1000),
      })).toString("base64url");
      const invalidTokens = [
        jwt.sign(claims, null, {
          algorithm: "none",
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }),
        jwt.sign(claims, `${config.jwtSecret}wrong`, validOptions),
        jwt.sign(claims, config.jwtSecret, { ...validOptions, expiresIn: -1 }),
        tampered.join("."),
        jwt.sign(claims, config.jwtSecret, { ...validOptions, issuer: "wrong-issuer" }),
        jwt.sign(claims, config.jwtSecret, { ...validOptions, audience: "wrong-audience" }),
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get("/auth/me")
          .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: { field: null, message: "Please log in to continue." },
        });
      }
    });

  test("logout invalidates the current token version", async () => {
      const authorization = `Bearer ${registration.body.token}`;

      const logout = await request(app)
        .post("/auth/logout")
        .send({})
        .set("Authorization", authorization);
      const currentUser = await request(app)
        .get("/auth/me")
        .set("Authorization", authorization);

      expect(logout.status).toBe(204);
      expect(currentUser.status).toBe(401);
    });

  test("password change invalidates old token and returns a fresh token", async () => {
      const oldAuthorization = `Bearer ${registration.body.token}`;
      const changed = await request(app)
        .post("/auth/change-password")
        .set("Authorization", oldAuthorization)
        .send({
          currentPassword: userInput.password,
          newPassword: "a-different-strong-password",
        });

      expect(changed.status).toBe(200);
      expect(typeof changed.body.token).toBe("string");
      expect((await request(app)
        .get("/auth/me")
        .set("Authorization", oldAuthorization)).status).toBe(401);
      expect((await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${changed.body.token}`)).status).toBe(200);

      const saved = await pool.query(
        "SELECT password_hash FROM users WHERE email = $1",
        ["sweety.user@example.com"],
      );
      expect(await bcrypt.compare("a-different-strong-password", saved.rows[0].password_hash))
        .toBe(true);
      expect(bcrypt.getRounds(saved.rows[0].password_hash)).toBe(12);
    });
  describe("rate limiting", () => {
    const originalRateLimitEnabled = config.rateLimitsEnabled;
    const originalAuthLimit = config.authRateLimitMax;
    const originalFailureLimit = config.loginFailureRateLimitMax;
    const originalFailureWindow = config.loginFailureRateLimitWindowMs;

    beforeAll(() => {
      config.rateLimitsEnabled = true;
      config.authRateLimitMax = 100;
      config.loginFailureRateLimitMax = 5;
      config.loginFailureRateLimitWindowMs = 5000;
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
      const eventCountBefore = await pool.query(
        "SELECT count(*)::int AS count FROM security_events WHERE event_type = 'rate_limited'",
      );

      for (let attempt = 0; attempt < 5; attempt += 1) {
        failures.push(await request(app)
          .post("/auth/login")
          .send({ email, password: "wrong-password" }));
      }

      const blocked = await request(app)
        .post("/auth/login")
        .set("X-Request-Id", "login-lockout-event")
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
      const eventCountAfter = await pool.query(
        "SELECT count(*)::int AS count FROM security_events WHERE event_type = 'rate_limited'",
      );
      expect(eventCountAfter.rows[0].count).toBe(eventCountBefore.rows[0].count + 1);
    });

    test("failed-login limit resets after its configured window", async () => {
      const email = `reset-${Date.now()}@example.com`;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request(app)
          .post("/auth/login")
          .send({ email, password: "wrong-password" });
        expect(response.status).toBe(401);
      }

      await new Promise((resolve) => setTimeout(resolve, 5025));

      const afterWindow = await request(app)
        .post("/auth/login")
        .send({ email, password: "wrong-password" });
      expect(afterWindow.status).toBe(401);
      expect(afterWindow.body.error.message).toBe("Invalid email or password.");
    }, 15000);

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
