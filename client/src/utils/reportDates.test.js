import { describe, expect, it } from "vitest";
import {
  formatReportAxisDate,
  formatReportDate,
  formatReportRange,
} from "./reportDates.js";

describe("report date formatting", () => {
  it("formats a date string without timezone conversion", () => {
    expect(formatReportDate("2026-10-15")).toBe("15 Oct 2026");
    expect(formatReportAxisDate("2026-10-01")).toBe("1 Oct");
  });

  it("formats an inclusive range in one year", () => {
    expect(formatReportRange("2026-10-01", "2026-10-15"))
      .toBe("1 Oct – 15 Oct 2026");
  });

  it("formats single-day and cross-year ranges", () => {
    expect(formatReportRange("2026-10-15", "2026-10-15")).toBe("15 Oct 2026");
    expect(formatReportRange("2025-12-01", "2025-12-31"))
      .toBe("1 Dec – 31 Dec 2025");
    expect(formatReportRange("2025-12-01", "2026-01-31"))
      .toBe("1 Dec 2025 – 31 Jan 2026");
  });
});
