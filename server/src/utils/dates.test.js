import {
  firstOfMonth,
  isValidDateString,
  previousMonthRange,
} from "./dates.js";

describe("date utilities", () => {
  test("validates leap year February and rejects impossible dates", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2025-02-29")).toBe(false);
  });

  test("requires strict YYYY-MM-DD strings", () => {
    expect(isValidDateString("2026-2-03")).toBe(false);
    expect(isValidDateString("2026/02/03")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
  });

  test("returns the first day of a date's month", () => {
    expect(firstOfMonth("2026-08-31")).toBe("2026-08-01");
  });

  test("selects December of the previous year for a January date", () => {
    expect(previousMonthRange("2026-01-15")).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });

  test("uses the leap-day count for the previous February", () => {
    expect(previousMonthRange("2024-03-31")).toEqual({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
  });

  test("uses 28 days for a non-leap February", () => {
    expect(previousMonthRange("2026-03-31")).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  test("uses 30 days for a previous 30-day month", () => {
    expect(previousMonthRange("2026-05-01")).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
  });

  test("uses 31 days for a previous 31-day month", () => {
    expect(previousMonthRange("2026-08-01")).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });
});
