import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage.jsx";
import Spinner from "../components/Spinner.jsx";
import { api } from "../api/client.js";
import { getRequestError } from "../utils/requestErrors.js";
import { todayInTimezone } from "../utils/dates.js";
import { formatReportRange } from "../utils/reportDates.js";

const LazyReportChart = lazy(() => import("../components/ReportChart.jsx"));

const reportTypes = [
  { key: "daily", title: "Daily", endpoint: "/reports/daily" },
  {
    key: "month-to-date",
    title: "Month to date",
    endpoint: "/reports/month-to-date",
  },
  { key: "monthly", title: "Previous month", endpoint: "/reports/monthly" },
];

function loadingReports() {
  return Object.fromEntries(
    reportTypes.map(({ key }) => [key, { data: null, loading: true, error: "" }]),
  );
}

export default function Reports() {
  const [date, setDate] = useState(todayInTimezone);
  const [reports, setReports] = useState(loadingReports);
  const [chart, setChart] = useState({ data: [], loading: true, error: "" });

  useEffect(() => {
    let active = true;
    setReports(loadingReports());
    setChart({ data: [], loading: true, error: "" });

    reportTypes.forEach(async (report) => {
      try {
        const response = await api.get(report.endpoint, { params: { date } });
        if (active) {
          setReports((current) => ({
            ...current,
            [report.key]: { data: response.data, loading: false, error: "" },
          }));
        }
      } catch (error) {
        if (active) {
          setReports((current) => ({
            ...current,
            [report.key]: {
              data: null,
              loading: false,
              error: getRequestError(error).message,
            },
          }));
        }
      }
    });

    api.get("/reports/chart", { params: { date } })
      .then((response) => {
        if (active) {
          setChart({ data: response.data, loading: false, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setChart({
            data: [],
            loading: false,
            error: getRequestError(error).message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [date]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your readings at a glance</p>
          <h1>Reports</h1>
        </div>
        <div className="date-picker">
          <label htmlFor="report-date">Choose a date</label>
          <input
            id="report-date"
            type="date"
            value={date}
            max={todayInTimezone()}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>

      <section className="report-grid" aria-label="Glucose reports">
        {reportTypes.map((report) => (
          <ReportCard
            key={report.key}
            title={report.title}
            state={reports[report.key]}
            showReadings={report.key === "daily"}
          />
        ))}
        <Suspense fallback={<div className="report-card chart-card"><Spinner label="Loading chart" /></div>}>
          <LazyReportChart state={chart} />
        </Suspense>
      </section>
    </main>
  );
}

function ReportCard({ title, state, showReadings }) {
  return (
    <article className={`report-card${showReadings ? " report-card-wide" : ""}`}>
      <h2>{title}</h2>
      {state.loading ? (
        <Spinner label={`Loading ${title.toLowerCase()} report`} />
      ) : state.error ? (
        <ErrorMessage>{state.error}</ErrorMessage>
      ) : (
        <ReportContent
          title={title}
          report={state.data}
          showReadings={showReadings}
        />
      )}
    </article>
  );
}

function ReportContent({ title, report, showReadings }) {
  return (
    <>
      <div className="report-card-heading">
        <h2>{title}: {formatReportRange(report.from, report.to)}</h2>
        <span className="reading-count">{report.count} readings</span>
      </div>
      {report.count === 0 ? (
        <p className="report-empty">
          No readings for this period yet.{" "}
          <Link to="/dashboard">Add a reading on the Dashboard.</Link>
        </p>
      ) : (
        <>
          <dl className="metric-list">
            <Metric label="Highest" value={report.highest} />
            <Metric label="Lowest" value={report.lowest} />
            <Metric label="Average" value={report.average} />
            <Metric label="Number of readings" value={report.count} isCount />
          </dl>
          {showReadings && (
            <div className="daily-readings">
              <h3>Daily readings</h3>
              <ul>
                {report.readings.map((reading) => (
                  <li key={reading.slot}>
                    <span>{reading.slotLabel}</span>
                    <strong>{reading.value} mg/dl</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Metric({ label, value, isCount = false }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>
        {value === null ? "—" : isCount ? value : `${Number(value).toFixed(1)} mg/dl`}
      </dd>
    </div>
  );
}
