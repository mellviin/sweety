import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "./client.js";

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  clearStoredToken();
});

describe("API client", () => {
  it("uses sessionStorage and removes any legacy persistent token", () => {
    localStorage.setItem("sweety_token", "legacy-token");

    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem("sweety_token")).toBeNull();

    storeToken("session-token");
    expect(sessionStorage.getItem("sweety_token")).toBe("session-token");
    expect(localStorage.getItem("sweety_token")).toBeNull();
  });

  it("adds the saved bearer token to requests", async () => {
    storeToken("saved-token");
    const adapter = vi.fn(async (request) => ({
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
    }));
    api.defaults.adapter = adapter;

    await api.get("/auth/me");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer saved-token");
  });

  it("clears the token and emits an unauthorized redirect event on protected 401s", async () => {
    storeToken("expired-token");
    const onUnauthorized = vi.fn();
    window.addEventListener("sweety:unauthorized", onUnauthorized);
    api.defaults.adapter = async (request) => {
      const response = {
        status: 401,
        data: { error: { message: "Please log in to continue." } },
        headers: {},
        config: request,
      };
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, null, response);
    };

    try {
      await expect(api.get("/reports/daily")).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(sessionStorage.getItem("sweety_token")).toBeNull();
      expect(localStorage.getItem("sweety_token")).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledOnce();
      expect(onUnauthorized.mock.calls[0][0].detail)
        .toEqual({ sessionExpired: true });
    } finally {
      window.removeEventListener("sweety:unauthorized", onUnauthorized);
    }
  });

  it("clears the token without treating bad credentials as session expiry", async () => {
    storeToken("existing-token");
    const onUnauthorized = vi.fn();
    window.addEventListener("sweety:unauthorized", onUnauthorized);
    api.defaults.adapter = async (request) => {
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, null, {
        status: 401,
        data: { error: { message: "Invalid email or password." } },
        headers: {},
        config: request,
      });
    };

    try {
      await expect(api.post("/auth/login", {})).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(sessionStorage.getItem("sweety_token")).toBeNull();
      expect(localStorage.getItem("sweety_token")).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledOnce();
      expect(onUnauthorized.mock.calls[0][0].detail)
        .toEqual({ sessionExpired: false });
    } finally {
      window.removeEventListener("sweety:unauthorized", onUnauthorized);
    }
  });
});
