import request from "supertest";
import app from "./app.js";

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
});
