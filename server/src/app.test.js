import express from "express";
import { jest } from "@jest/globals";
import request from "supertest";
import app from "./app.js";
import { errorHandler } from "./middleware/errorHandler.js";

describe("API app", () => {
  test("GET /health returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
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

  test("unexpected production errors are logged without exposing details", async () => {
    const testApp = express();
    const previousEnvironment = process.env.NODE_ENV;
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    testApp.get("/failure", () => {
      throw new Error("private diagnostic detail");
    });
    testApp.use(errorHandler);

    try {
      const response = await request(testApp).get("/failure");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { field: null, message: "Internal server error" },
      });
      expect(JSON.stringify(response.body)).not.toContain("private diagnostic detail");
      expect(consoleError).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousEnvironment;
      consoleError.mockRestore();
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
});
