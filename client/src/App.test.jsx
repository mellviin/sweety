import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("./api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      get: apiMocks.get,
      post: apiMocks.post,
    },
  };
});

function renderApp(path = "/login") {
  window.history.pushState({}, "", path);
  return render(
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe("authentication screens", () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.get.mockResolvedValue({
      data: { user: { id: 1, name: "Sweety User", email: "sweety@example.com" } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated protected pages to login", async () => {
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Log in to Sweety" })).toBeVisible();
  });

  it("shows a clear invalid credentials message", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: {
        data: { error: { field: null, message: "Invalid email or password." } },
      },
    });
    renderApp();

    await user.type(screen.getByLabelText("Email"), "sweety@example.com");
    await user.type(screen.getByLabelText("Password"), "incorrect-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
  });

  it("shows a friendly message when the server cannot be reached", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue(new Error("Network Error"));
    renderApp();

    await user.type(screen.getByLabelText("Email"), "sweety@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server. Please try again.",
    );
  });

  it("checks password confirmation before registering", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await user.type(screen.getByLabelText("Name"), "Sweety User");
    await user.type(screen.getByLabelText("Email"), "sweety@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeVisible();
    expect(apiMocks.post).not.toHaveBeenCalled();
  });

  it("registers and redirects to the dashboard", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({
      data: {
        token: "registered-token",
        user: { id: 2, name: "New Patient", email: "new@example.com" },
      },
    });
    renderApp("/register");

    await user.type(screen.getByLabelText("Name"), "New Patient");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Welcome, New Patient" }))
      .toBeVisible();
    expect(localStorage.getItem("sweety_token")).toBe("registered-token");
  });

  it("logs in and persists the token", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({
      data: {
        token: "login-token",
        user: { id: 1, name: "Sweety User", email: "sweety@example.com" },
      },
    });
    renderApp();

    await user.type(screen.getByLabelText("Email"), "sweety@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Welcome, Sweety User" }))
      .toBeVisible();
    expect(localStorage.getItem("sweety_token")).toBe("login-token");
  });

  it("restores the saved token and user after reload", async () => {
    localStorage.setItem("sweety_token", "restored-token");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Welcome, Sweety User" }))
      .toBeVisible();
    expect(apiMocks.get).toHaveBeenCalledWith("/auth/me");
  });

  it("logs out and clears the saved token", async () => {
    const user = userEvent.setup();
    localStorage.setItem("sweety_token", "restored-token");
    renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Welcome, Sweety User" });

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in to Sweety" }))
      .toBeVisible();
    expect(localStorage.getItem("sweety_token")).toBeNull();
  });

  it("renders field-specific server validation errors", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: {
        data: {
          error: {
            field: "email",
            message: "An account with this email already exists.",
          },
        },
      },
    });
    renderApp("/register");

    await user.type(screen.getByLabelText("Name"), "Sweety User");
    await user.type(screen.getByLabelText("Email"), "sweety@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("An account with this email already exists."))
        .toBeVisible();
    });
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
