import { useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage.jsx";
import Spinner from "../components/Spinner.jsx";
import { api } from "../api/client.js";
import { getRequestError } from "../utils/requestErrors.js";
import { todayInTimezone } from "../utils/dates.js";
import { slots } from "../utils/slots.js";

const reportTypes = [
  { key: "daily", title: "Daily", endpoint: "/reports/daily" },
  {
    key: "month-to-date",
    title: "Month to date",
    endpoint: "/reports/month-to-date",
  },
  { key: "monthly", title: "Previous month", endpoint: "/reports/monthly" },
];

export default function Reports() {
  const [date, setDate] = useState(todayInTimezone);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setErrorMessage("");

      try {
        const entries = await Promise.all(
          reportTypes.map(async (report) => {
            const response = await api.get(report.endpoint, { params: { date } });
            return [report.key, response.data];
          }),
        );

        if (active) {
          setReports(Object.fromEntries(entries));
        }
      } catch (error) {
        if (active) {
          setErrorMessage(getRequestError(error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReports();
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

      <ErrorMessage>{errorMessage}</ErrorMessage>
      {loading ? (
        <Spinner label="Loading your reports" />
      ) : (
        <section className="report-grid" aria-label="Glucose reports">
          {reportTypes.map((report) => (
            <ReportCard
              key={report.key}
              title={report.title}
              report={reports[report.key]}
              showReadings={report.key === "daily"}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function ReportCard({ title, report, showReadings }) {
  if (!report) {
    return null;
  }

  return (
    <article className={`report-card${showReadings ? " report-card-wide" : ""}`}>
      <div className="report-card-heading">
        <div>
          <p className="eyebrow">{report.from} to {report.to}</p>
          <h2>{title}</h2>
        </div>
        <span className="reading-count">{report.count} readings</span>
      </div>
      <dl className="metric-list">
        <Metric label="Highest" value={report.highest} />
        <Metric label="Average" value={report.average} />
        <Metric label="Lowest" value={report.lowest} />
      </dl>
      {showReadings && (
        <div className="daily-readings">
          <h3>Daily readings</h3>
          {report.readings.length === 0 ? (
            <p className="muted-copy">No readings for this date yet.</p>
          ) : (
            <ul>
              {report.readings.map((reading) => (
                <li key={reading.slot}>
                  <span>{slots.find((slot) => slot.value === reading.slot)?.label}</span>
                  <strong>{reading.value} <span>mg/dL</span></strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value === null ? "—" : `${value} mg/dL`}</dd>
    </div>
  );
}
