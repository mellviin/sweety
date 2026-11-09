import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartTooltip } from "./ReportChart.jsx";

afterEach(cleanup);

const points = [
  { date: "2026-11-03", slot: "MORNING_FASTING", slotLabel: "Morning (fasting)", value: 99 },
  { date: "2026-11-03", slot: "AFTER_BREAKFAST", slotLabel: "After breakfast", value: 215 },
  { date: "2026-11-03", slot: "AFTER_LUNCH", slotLabel: "After lunch", value: 140 },
  { date: "2026-11-03", slot: "AFTER_DINNER", slotLabel: "After dinner", value: 120 },
];

describe("ChartTooltip", () => {
  it.each(points)("renders the hovered $slot point's details", (point) => {
    render(
      <ChartTooltip
        active
        payload={[{ payload: point }]}
        label="a different point"
      />,
    );

    expect(screen.getByText("3 Nov 2026")).toBeVisible();
    expect(screen.getByText(point.slotLabel)).toBeVisible();
    expect(screen.getByText(`${point.value} mg/dl`)).toBeVisible();
  });
});
