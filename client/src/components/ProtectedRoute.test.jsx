import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute.jsx";

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ loading: false, user: null }),
}));

describe("ProtectedRoute", () => {
  it("redirects a logged-out user to the login page", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<ProtectedRoute><p>Private dashboard</p></ProtectedRoute>}
          />
          <Route path="/login" element={<h1>Log in to Sweety</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Log in to Sweety" }))
      .toBeVisible();
    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
  });
});
