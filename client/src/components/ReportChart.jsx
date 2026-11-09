import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ErrorMessage from "./ErrorMessage.jsx";
import Spinner from "./Spinner.jsx";
import { buildChartPoints } from "../utils/buildChartPoints.js";
import { formatReportAxisDate, formatReportDate } from "../utils/reportDates.js";

export default function ReportChart({ state, selectedDate }) {
  const points = buildChartPoints(state.data);
  const chartDate = points[0]?.date ?? selectedDate;
  const lastPointDate = points.at(-1)?.date;
  const lastDay = Number(
    lastPointDate ? lastPointDate.split("-")[2] : selectedDate.split("-")[2],
  );
  const [year, chartMonth] = chartDate.split("-");
  const ticks = Array.from({ length: lastDay }, (_value, index) => index + 1);

  return (
    <article className="report-card chart-card">
      <h2>Readings this month</h2>
      {state.loading ? (
        <Spinner label="Loading chart" />
      ) : state.error ? (
        <ErrorMessage>{state.error}</ErrorMessage>
      ) : state.data.length === 0 ? (
        <p className="report-empty">No readings for this period yet.</p>
      ) : (
        <div
          className="chart-container"
          role="img"
          aria-label="Line chart of glucose readings by date and time slot"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 16, right: 24, bottom: 20, left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#dce8e2" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[1, lastDay + 0.75]}
                ticks={ticks}
                tickFormatter={(tick) => formatReportAxisDate(
                  `${year}-${chartMonth}-${String(tick).padStart(2, "0")}`,
                )}
                minTickGap={24}
              >
                <Label value="date" position="insideBottom" offset={-14} />
              </XAxis>
              <YAxis>
                <Label value="mg/dl" angle={-90} position="insideLeft" />
              </YAxis>
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="linear"
                dataKey="value"
                name="Glucose"
                stroke="#28765f"
                strokeWidth={3}
                dot={{ r: 4, fill: "#28765f" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const reading = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{formatReportDate(reading.date)}</strong>
      <span>{reading.slotLabel}</span>
      <span>{reading.value} mg/dl</span>
    </div>
  );
}
