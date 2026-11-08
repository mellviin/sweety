import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Reports from "./Reports.jsx";

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../api/client.js", () => ({ api: apiMocks }));
vi.mock("recharts", () => {
  const Element = ({ children }) => <div>{children}</div>;
  return {
    CartesianGrid: Element,
    Label: Element,
    Line: Element,
    LineChart: Element,
    ResponsiveContainer: Element,
    Tooltip: Element,
    XAxis: Element,
    YAxis: Element,
  };
});

function renderReports() {
  return render(
    <BrowserRouter>
      <Reports />
    </BrowserRouter>,
  );
}

const dailyReport = {
  from: "2026-10-15",
  to: "2026-10-15",
  count: 2,
  highest: 150,
  lowest: 100,
  average: 125,
  readings: [
    { slot: "MORNING_FASTING", slotLabel: "Morning (fasting)", value: 100 },
    { slot: "AFTER_BREAKFAST", slotLabel: "After breakfast", value: 150 },
  ],
};

describe("Reports page", () => {
  beforeEach(() => {
    apiMocks.get.mockReset().mockImplementation((endpoint) => {
      if (endpoint === "/reports/daily") {
        return Promise.resolve({ data: dailyReport });
      }
      if (endpoint === "/reports/month-to-date") {
        return Promise.resolve({
          data: { from: "2026-10-01", to: "2026-10-15", count: 2, highest: 150, lowest: 100, average: 125 },
        });
      }
      if (endpoint === "/reports/monthly") {
        return Promise.resolve({
          data: { from: "2026-09-01", to: "2026-09-30", count: 0, highest: null, lowest: null, average: null },
        });
      }
      return Promise.resolve({ data: [{ date: "2026-10-15", slot: "MORNING_FASTING", value: 100 }] });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches each report and chart for the chosen date and formats daily readings", async () => {
    renderReports();

    await screen.findByRole("heading", { name: "Daily: 15 Oct 2026" });
    expect(apiMocks.get).toHaveBeenCalledTimes(4);
    for (const endpoint of [
      "/reports/daily",
      "/reports/month-to-date",
      "/reports/monthly",
      "/reports/chart",
    ]) {
      expect(apiMocks.get).toHaveBeenCalledWith(
        endpoint,
        { params: { date: expect.any(String) } },
      );
    }

    fireEvent.change(screen.getByLabelText("Choose a date"), {
      target: { value: "2026-10-15" },
    });

    expect(await screen.findByRole("heading", {
      name: "Month to date: 1 Oct – 15 Oct 2026",
    })).toBeVisible();
    expect(screen.getByRole("heading", {
      name: "Previous month: 1 Sep – 30 Sep 2026",
    })).toBeVisible();
    expect(screen.getAllByText("100.0 mg/dl").length).toBeGreaterThan(0);
    expect(screen.getAllByText("150.0 mg/dl").length).toBeGreaterThan(0);
    expect(screen.getByText("Morning (fasting)")).toBeVisible();
    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith(
        "/reports/chart",
        { params: { date: "2026-10-15" } },
      );
    });
  });

  it("shows a dashboard link for an empty report and keeps errors per card", async () => {
    apiMocks.get.mockImplementation((endpoint) => {
      if (endpoint === "/reports/daily") {
        return Promise.reject(new Error("network down"));
      }
      if (endpoint === "/reports/monthly") {
        return Promise.resolve({
          data: { from: "2026-09-01", to: "2026-09-30", count: 0, highest: null, lowest: null, average: null },
        });
      }
      if (endpoint === "/reports/month-to-date") {
        return Promise.resolve({
          data: { from: "2026-10-01", to: "2026-10-15", count: 0, highest: null, lowest: null, average: null },
        });
      }
      return Promise.resolve({ data: [] });
    });
    renderReports();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server. Please try again.",
    );
    expect(screen.getAllByText(/No readings for this period yet/)).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: /Add a reading on the Dashboard/ }))
      .toHaveLength(2);
    expect(screen.queryByText("No readings for this date yet.")).not.toBeInTheDocument();
  });

  it("limits the report date picker to today", () => {
    renderReports();

    expect(screen.getByLabelText("Choose a date")).toHaveAttribute(
      "max",
      screen.getByLabelText("Choose a date").value,
    );
  });
});
