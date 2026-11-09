import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
    sessionStorage.clear();
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.get.mockImplementation((path) => (
      path === "/auth/me"
        ? {
          data: {
            user: { id: 1, name: "Sweety User", email: "sweety@example.com" },
          },
        }
        : { data: { data: [] } }
    ));
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
    const registeredUser = {
      id: 2,
      name: "New Patient",
      email: "new@example.com",
    };
    apiMocks.post.mockResolvedValue({
      data: {
        token: "registered-token",
        user: registeredUser,
      },
    });
    apiMocks.get.mockImplementation((path) => (
      path === "/auth/me"
        ? Promise.resolve({ data: { user: registeredUser } })
        : Promise.resolve({ data: { data: [] } })
    ));
    renderApp("/register");

    await user.type(screen.getByLabelText("Name"), "New Patient");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole(
      "heading",
      { name: "Welcome, New Patient" },
      { timeout: 5000 },
    ))
      .toBeVisible();
    expect(sessionStorage.getItem("sweety_token")).toBe("registered-token");
    expect(localStorage.getItem("sweety_token")).toBeNull();
  });

  it("ignores a late session restore after registration succeeds", async () => {
    const user = userEvent.setup();
    const restoredUser = {
      id: 1,
      name: "Sweety User",
      email: "sweety@example.com",
    };
    const registeredUser = {
      id: 2,
      name: "New Patient",
      email: "new@example.com",
    };
    let resolveRestore;

    sessionStorage.setItem("sweety_token", "old-token");
    apiMocks.get.mockImplementation((path) => {
      if (path === "/auth/me") {
        return new Promise((resolve) => {
          resolveRestore = resolve;
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });
    apiMocks.post.mockResolvedValue({
      data: { token: "registered-token", user: registeredUser },
    });
    renderApp("/register");

    await user.type(screen.getByLabelText("Name"), "New Patient");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole(
      "heading",
      { name: "Welcome, New Patient" },
      { timeout: 5000 },
    )).toBeVisible();

    await act(async () => {
      resolveRestore({ data: { user: restoredUser } });
    });

    expect(screen.getByRole("heading", { name: "Welcome, New Patient" }))
      .toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome, Sweety User" }))
      .not.toBeInTheDocument();
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

    expect(await screen.findByRole(
      "heading",
      { name: "Welcome, Sweety User" },
      { timeout: 5000 },
    ))
      .toBeVisible();
    expect(sessionStorage.getItem("sweety_token")).toBe("login-token");
    expect(localStorage.getItem("sweety_token")).toBeNull();
  });

  it("restores the saved token and user after reload", async () => {
    sessionStorage.setItem("sweety_token", "restored-token");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Welcome, Sweety User" }))
      .toBeVisible();
    expect(apiMocks.get).toHaveBeenCalledWith("/auth/me");
  });

  it("renders a malicious-looking user name as text", async () => {
    const name = "<img src=x onerror=alert(1)>";
    sessionStorage.setItem("sweety_token", "restored-token");
    apiMocks.get.mockImplementation((path) => (
      path === "/auth/me"
        ? Promise.resolve({
          data: { user: { id: 1, name, email: "sweety@example.com" } },
        })
        : Promise.resolve({ data: { data: [] } })
    ));
    renderApp("/dashboard");

    const heading = await screen.findByRole("heading", {
      name: `Welcome, ${name}`,
    });

    expect(heading.textContent).toBe(`Welcome, ${name}`);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a session-expiry message and redirects to login on an expired session", async () => {
    sessionStorage.setItem("sweety_token", "expired-token");
    renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Welcome, Sweety User" });

    act(() => {
      sessionStorage.removeItem("sweety_token");
      window.dispatchEvent(new CustomEvent("sweety:unauthorized", {
        detail: { sessionExpired: true },
      }));
    });

    expect(await screen.findByRole("heading", { name: "Log in to Sweety" }))
      .toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired. Please log in again.",
    );
  });

  it("logs out and clears the saved token", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("sweety_token", "restored-token");
    renderApp("/dashboard");
    await screen.findByRole("heading", { name: "Welcome, Sweety User" });

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in to Sweety" }))
      .toBeVisible();
    expect(sessionStorage.getItem("sweety_token")).toBeNull();
    expect(localStorage.getItem("sweety_token")).toBeNull();
    expect(apiMocks.post).toHaveBeenCalledWith(
      "/auth/logout",
      {},
      { headers: { Authorization: "Bearer restored-token" } },
    );
  });

  it("changes the password from the profile and stores the refreshed token", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("sweety_token", "restored-token");
    apiMocks.post.mockResolvedValue({ data: { token: "refreshed-token" } });
    renderApp("/profile");
    await screen.findByRole("heading", { name: "Change password" });

    await user.type(screen.getByLabelText("Current password"), "current-password");
    await user.type(screen.getByLabelText("New password"), "new-password-value");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-value");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Password updated.");
    expect(sessionStorage.getItem("sweety_token")).toBe("refreshed-token");
    expect(apiMocks.post).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "current-password",
      newPassword: "new-password-value",
    });
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
