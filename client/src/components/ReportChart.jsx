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
import { formatReportAxisDate, formatReportRange } from "../utils/reportDates.js";
import { slots } from "../utils/slots.js";

export default function ReportChart({ state }) {
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
              data={state.data}
              margin={{ top: 16, right: 24, bottom: 20, left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#dce8e2" />
              <XAxis
                dataKey="date"
                tickFormatter={formatReportAxisDate}
                minTickGap={24}
              >
                <Label value="date" position="insideBottom" offset={-14} />
              </XAxis>
              <YAxis>
                <Label value="mg/dl" angle={-90} position="insideLeft" />
              </YAxis>
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const reading = payload[0].payload;
  const slot = slots.find((item) => item.value === reading.slot);

  return (
    <div className="chart-tooltip">
      <strong>{formatReportRange(label, label)}</strong>
      <span>{slot?.label ?? reading.slot}</span>
      <span>{reading.value} mg/dl</span>
    </div>
  );
}
