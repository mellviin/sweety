import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import FormField from "../components/FormField.jsx";
import ReadingForm from "../components/ReadingForm.jsx";
import Spinner from "../components/Spinner.jsx";
import { api } from "../api/client.js";
import { todayInTimezone } from "../utils/dates.js";
import { getRequestError } from "../utils/requestErrors.js";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayInTimezone);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [editingReading, setEditingReading] = useState(null);

  const fetchReadings = useCallback(async (date) => {
    const response = await api.get("/readings", { params: { date } });
    return response.data.data;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError("");

    fetchReadings(selectedDate)
      .then((data) => {
        if (active) {
          setReadings(data);
        }
      })
      .catch((error) => {
        if (active) {
          setFetchError(getRequestError(error).message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchReadings, selectedDate]);

  function startEditing(reading) {
    setEditingReading(reading);
  }

  function selectDate(event) {
    const date = event.target.value;
    setSelectedDate(date);
    setEditingReading(null);
  }

  async function deleteReading(reading) {
    if (!window.confirm(`Delete the ${reading.slotLabel} reading?`)) {
      return;
    }

    setFetchError("");
    try {
      await api.delete(`/readings/${reading.id}`);
      setReadings(await fetchReadings(selectedDate));
    } catch (error) {
      setFetchError(getRequestError(error).message);
    }
  }

  return (
    <main className="page-shell">
      <section className="welcome-panel">
        <p className="eyebrow">Your health, one step at a time</p>
        <h1>Welcome, {user?.name}</h1>
        <p>
          Keep your glucose readings together and review your progress whenever
          you need.
        </p>
        <Link className="button button-primary" to="/reports">
          View your reports
        </Link>
      </section>

      <section className="reading-management" aria-labelledby="readings-title">
        <div className="reading-list-header">
          <div>
            <p className="eyebrow">Your daily log</p>
            <h2 id="readings-title">Readings for {selectedDate}</h2>
          </div>
          <div className="reading-count" aria-live="polite">
            {loading || fetchError ? "—" : readings.length} of 4 readings added
          </div>
        </div>

        <FormField
          id="selectedDate"
          label="Choose a date"
          type="date"
          value={selectedDate}
          max={todayInTimezone()}
          onChange={selectDate}
        />

        <ErrorMessage>{fetchError}</ErrorMessage>
        {loading ? (
          <Spinner label="Loading readings" />
        ) : fetchError ? null : readings.length === 0 ? (
          <p className="reading-empty">No readings for this date yet.</p>
        ) : (
          <ul className="reading-list">
            {readings.map((reading) => (
              <li className="reading-item" key={reading.id}>
                <div className="reading-details">
                  <span className="reading-slot">{reading.slotLabel}</span>
                  <strong>{reading.value} mg/dl</strong>
                </div>
                <div className="reading-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => startEditing(reading)}
                  >
                    Edit
                    <span className="visually-hidden"> {reading.slotLabel}</span>
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => deleteReading(reading)}
                  >
                    Delete
                    <span className="visually-hidden"> {reading.slotLabel}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ReadingForm
          selectedDate={selectedDate}
          reading={editingReading}
          onCancel={() => setEditingReading(null)}
          onSaved={async () => {
            try {
              setReadings(await fetchReadings(selectedDate));
              setFetchError("");
            } catch (error) {
              setFetchError(getRequestError(error).message);
            }
          }}
        />
      </section>
    </main>
  );
}
