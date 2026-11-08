import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api/client.js", () => ({ api: apiMocks }));
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { name: "Sweety User" } }),
}));

const reading = {
  id: 1,
  date: "2026-11-08",
  slot: "MORNING_FASTING",
  slotLabel: "Morning (fasting)",
  value: 95,
};

function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>,
  );
}

function listResponse(data = []) {
  return { data: { data } };
}

describe("Dashboard readings", () => {
  beforeEach(() => {
    apiMocks.get.mockReset().mockResolvedValue(listResponse());
    apiMocks.post.mockReset().mockResolvedValue({ data: { data: reading } });
    apiMocks.put.mockReset().mockResolvedValue({ data: { data: reading } });
    apiMocks.delete.mockReset().mockResolvedValue({ data: {} });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the selected date, shows empty state, and limits the date picker to today", async () => {
    renderDashboard();

    expect(await screen.findByText("No readings for this date yet.")).toBeVisible();
    expect(apiMocks.get).toHaveBeenCalledWith(
      "/readings",
      { params: { date: expect.any(String) } },
    );
    expect(screen.getByLabelText("Choose a date")).toHaveAttribute(
      "max",
      screen.getByLabelText("Choose a date").value,
    );
    expect(screen.getByText("0 of 4 readings added")).toBeVisible();
    expect(screen.getByLabelText("Glucose value (mg/dl)")).not.toHaveAttribute("min");
    expect(screen.getByLabelText("Glucose value (mg/dl)")).not.toHaveAttribute("max");
  });

  it("shows readings and refetches when the selected date changes", async () => {
    apiMocks.get.mockResolvedValueOnce(listResponse([reading]));
    renderDashboard();

    expect(await screen.findByText("95 mg/dl")).toBeVisible();
    expect(screen.getByText("1 of 4 readings added")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Choose a date"), {
      target: { value: "2026-10-10" },
    });

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenLastCalledWith(
        "/readings",
        { params: { date: "2026-10-10" } },
      );
    });
    expect(screen.getByLabelText("Reading date")).toHaveValue("2026-10-10");
  });

  it("creates a reading, clears the form, and reloads the list", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(await screen.findByLabelText("Glucose value (mg/dl)"), "120");
    await user.selectOptions(screen.getByLabelText("Time slot"), "AFTER_BREAKFAST");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith(
      "/readings",
      expect.objectContaining({
        date: expect.any(String),
        slot: "AFTER_BREAKFAST",
        value: "120",
      }),
    ));
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Glucose value (mg/dl)")).toHaveValue(null);
    expect(screen.getByLabelText("Time slot")).toHaveValue("");
  });

  it("edits a reading and supports canceling edit mode", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue(listResponse([reading]));
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Edit Morning (fasting)" }));
    expect(screen.getByLabelText("Glucose value (mg/dl)")).toHaveValue(95);
    expect(screen.getByLabelText("Time slot")).toHaveValue("MORNING_FASTING");
    await user.clear(screen.getByLabelText("Glucose value (mg/dl)"));
    await user.type(screen.getByLabelText("Glucose value (mg/dl)"), "110");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.put).toHaveBeenCalledWith(
      "/readings/1",
      expect.objectContaining({ value: "110" }),
    ));
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));

    await user.click(await screen.findByRole("button", { name: "Edit Morning (fasting)" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Add a reading" })).toBeVisible();
  });

  it("confirms deletion before deleting and refreshing", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue(listResponse([reading]));
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Delete Morning (fasting)" }));

    expect(confirm).toHaveBeenCalledWith("Delete the Morning (fasting) reading?");
    expect(apiMocks.delete).toHaveBeenCalledWith("/readings/1");
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["value", "Please enter a glucose value."],
    ["value", "Value must be between 40 and 600 mg/dl."],
    ["slot", "You already have an After breakfast reading for this date."],
    ["date", "You can add only 4 readings per day."],
    ["date", "Date cannot be in the future."],
  ])("shows the server %s validation message exactly", async (field, message) => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: { data: { error: { field, message } } },
    });
    renderDashboard();

    await screen.findByText("No readings for this date yet.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText(message, { selector: ".field-error" })).toBeVisible();
  });

  it("shows fetch errors instead of an empty state", async () => {
    apiMocks.get.mockRejectedValue(new Error("network down"));
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server. Please try again.",
    );
    expect(screen.queryByText("No readings for this date yet.")).not.toBeInTheDocument();
  });
});
