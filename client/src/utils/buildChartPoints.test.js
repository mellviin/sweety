import { describe, expect, it } from "vitest";
import { buildChartPoints } from "./buildChartPoints.js";

const sameDayReadings = [
  { date: "2026-11-03", slot: "MORNING_FASTING", slotLabel: "Morning (fasting)", value: 99 },
  { date: "2026-11-03", slot: "AFTER_BREAKFAST", slotLabel: "After breakfast", value: 215 },
  { date: "2026-11-03", slot: "AFTER_LUNCH", slotLabel: "After lunch", value: 140 },
  { date: "2026-11-03", slot: "AFTER_DINNER", slotLabel: "After dinner", value: 120 },
];

describe("buildChartPoints", () => {
  it("creates unique ascending points for readings sharing a date", () => {
    const points = buildChartPoints([...sameDayReadings].reverse());

    expect(points.map(({ x }) => x)).toEqual([3, 3.25, 3.5, 3.75]);
    expect(new Set(points.map(({ x }) => x)).size).toBe(4);
    expect(points.map(({ slot, value }) => [slot, value])).toEqual([
      ["MORNING_FASTING", 99],
      ["AFTER_BREAKFAST", 215],
      ["AFTER_LUNCH", 140],
      ["AFTER_DINNER", 120],
    ]);
  });

  it("handles one reading", () => {
    expect(buildChartPoints([sameDayReadings[1]])).toEqual([
      {
        x: 3.25,
        date: "2026-11-03",
        slot: "AFTER_BREAKFAST",
        slotLabel: "After breakfast",
        value: 215,
      },
    ]);
  });

  it("adds the slot label when the API response omits it", () => {
    const [point] = buildChartPoints([
      { date: "2026-11-03", slot: "AFTER_BREAKFAST", value: 215 },
    ]);

    expect(point.slotLabel).toBe("After breakfast");
  });

  it("handles no readings", () => {
    expect(buildChartPoints([])).toEqual([]);
  });

  it("orders points across different days", () => {
    const points = buildChartPoints([
      { ...sameDayReadings[0], date: "2026-11-12" },
      { ...sameDayReadings[1], date: "2026-11-02" },
    ]);

    expect(points.map(({ date, x }) => [date, x])).toEqual([
      ["2026-11-02", 2.25],
      ["2026-11-12", 12],
    ]);
  });
});
