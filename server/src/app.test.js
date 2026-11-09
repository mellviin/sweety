import express from "express";
import { jest } from "@jest/globals";
import request from "supertest";
import app, { createApp } from "./app.js";
import { config } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createLogger } from "./utils/logger.js";

describe("API app", () => {
  test("GET /health returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  test("returns a supplied request id and generates one when absent", async () => {
    const supplied = await request(app)
      .get("/health")
      .set("X-Request-Id", "step7.request-id");
    const generated = await request(app).get("/health");

    expect(supplied.headers["x-request-id"]).toBe("step7.request-id");
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("newline injection in an email is omitted from validation logs", async () => {
    const loggedLines = [];
    const write = jest.spyOn(process.stdout, "write")
      .mockImplementation((line) => {
        loggedLines.push(String(line));
        return true;
      });

    try {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "attacker@example.com\nINJECTED",
          password: "not-a-real-password",
        });

      expect(response.status).toBe(400);
      const output = loggedLines.join("");
      expect(output).not.toContain("attacker");
      expect(output).not.toContain("INJECTED");
      expect(output.trim().split("\n").map((line) => JSON.parse(line)))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({
            event: "validation_rejected",
            field: "email",
          }),
        ]));
    } finally {
      write.mockRestore();
    }
  });

  test("sets security headers and removes X-Powered-By", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'self';script-src 'self';object-src 'none';"
        + "frame-ancestors 'none';base-uri 'self'",
    );
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  test("enables HSTS only when created in production mode", async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await request(createApp()).get("/health");
      expect(response.headers["strict-transport-security"]).toContain(
        "max-age=",
      );
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

  test("does not grant CORS access to a foreign origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://attacker.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("only allows the configured CORS methods and headers", async () => {
    const response = await request(app)
      .options("/readings")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.headers["access-control-allow-origin"])
      .toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"])
      .toBe("GET,POST,PUT,DELETE");
    expect(response.headers["access-control-allow-headers"])
      .toBe("Authorization,Content-Type");
  });

  test("does not cache auth, reading, or report responses", async () => {
    const responses = await Promise.all([
      request(app).get("/auth/me"),
      request(app).get("/readings"),
      request(app).get("/reports/daily"),
    ]);

    expect(responses.map((response) => response.headers["cache-control"]))
      .toEqual(["no-store", "no-store", "no-store"]);
  });

  test("unknown routes use the standard error shape", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { field: null, message: "Route not found" },
    });
  });

  test("malformed JSON returns the standard client error", async () => {
    const response = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send("{invalid");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: null, message: "Invalid request body." },
    });
  });

  test("an 11KB JSON body is rejected", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({ name: "A".repeat(11 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body.error.field).toBeNull();
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("form-encoded bodies on JSON routes are rejected", async () => {
    const response = await request(app)
      .post("/auth/login")
      .type("form")
      .send({ email: "user@example.test", password: "password" });

    expect(response.status).toBe(415);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test.each(["__proto__", "constructor", "prototype"])(
    "request bodies with %s keys are rejected",
    async (key) => {
    const response = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        name: "User",
        [key]: { admin: true },
      }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { field: null, message: "Invalid request body." },
    });
    },
  );

  test("unexpected production errors are logged without exposing details", async () => {
    const testApp = express();
    const previousEnvironment = process.env.NODE_ENV;
    const loggedLines = [];
    const testLogger = createLogger((line) => loggedLines.push(line));
    process.env.NODE_ENV = "production";

    testApp.get("/failure", () => {
      throw new Error("private diagnostic detail");
    });
    testApp.use((error, req, res, next) => {
      testLogger.error("request_failed", {
        request_id: req.requestId,
        status: 500,
      });
      errorHandler(error, req, res, next);
    });

    try {
      const response = await request(testApp).get("/failure");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { field: null, message: "Internal server error" },
      });
      expect(JSON.stringify(response.body)).not.toContain("private diagnostic detail");
      expect(JSON.parse(loggedLines[0])).toMatchObject({
        event: "request_failed",
        status: 500,
      });
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

  test("production errors never expose SQL, library details, or stacks", async () => {
    const testApp = express();
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    testApp.get("/failure", () => {
      const error = new Error(
        "QueryFailedError: SELECT * FROM users; at node_modules/pg/client.js",
      );
      error.stack = "private stack trace";
      throw error;
    });
    testApp.use(errorHandler);

    try {
      const response = await request(testApp).get("/failure");
      const serialized = JSON.stringify(response.body);

      expect(response.status).toBe(500);
      expect(serialized).toBe(
        '{"error":{"message":"Internal server error","field":null}}',
      );
      expect(serialized).not.toContain("SELECT");
      expect(serialized).not.toContain("QueryFailedError");
      expect(serialized).not.toContain("node_modules");
      expect(serialized).not.toContain("private stack trace");
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

  test("does not apply authentication throttling in test mode", async () => {
    const responses = await Promise.all(
      Array.from({ length: 25 }, () =>
        request(app)
          .post("/auth/login")
          .send({ email: "invalid", password: "invalid" })),
    );

    expect(responses.every((response) => response.status === 400)).toBe(true);
  });

  test("global rate limiting can be enabled in test mode and returns Retry-After", async () => {
    const previousEnabled = config.rateLimitsEnabled;
    const previousLimit = config.globalRateLimitMax;
    const previousTrustProxy = app.get("trust proxy");
    config.rateLimitsEnabled = true;
    config.globalRateLimitMax = 1;
    app.set("trust proxy", 1);

    try {
      const clientIp = "192.0.2.21";
      expect((await request(app).get("/health")
        .set("X-Forwarded-For", clientIp)).status).toBe(200);
      const limited = await request(app).get("/health")
        .set("X-Forwarded-For", clientIp);

      expect(limited.status).toBe(429);
      expect(limited.headers["retry-after"]).toMatch(/^\d+$/);
      expect(limited.body).toEqual({
        error: {
          field: null,
          message: "Too many requests. Please try again later.",
        },
      });
    } finally {
      config.rateLimitsEnabled = previousEnabled;
      config.globalRateLimitMax = previousLimit;
      app.set("trust proxy", previousTrustProxy);
    }
  });
});
