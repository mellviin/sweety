import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorMessage from "../components/ErrorMessage.jsx";
import FormField from "../components/FormField.jsx";
import Spinner from "../components/Spinner.jsx";
import { api } from "../api/client.js";
import { todayInTimezone } from "../utils/dates.js";
import { getRequestError } from "../utils/requestErrors.js";
import { slots } from "../utils/slots.js";

function emptyForm(date) {
  return { date, slot: "", value: "" };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayInTimezone);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [form, setForm] = useState(() => emptyForm(todayInTimezone()));
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

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

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEditing(reading) {
    setEditingId(reading.id);
    setForm({
      date: reading.date,
      slot: reading.slot,
      value: String(reading.value),
    });
    setFormError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm(selectedDate));
    setFormError(null);
  }

  function selectDate(event) {
    const date = event.target.value;
    setSelectedDate(date);
    setEditingId(null);
    setForm(emptyForm(date));
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (editingId === null) {
        await api.post("/readings", form);
      } else {
        await api.put(`/readings/${editingId}`, form);
      }

      setEditingId(null);
      setForm(emptyForm(selectedDate));
      try {
        setReadings(await fetchReadings(selectedDate));
        setFetchError("");
      } catch (error) {
        setFetchError(getRequestError(error).message);
      }
    } catch (error) {
      setFormError(getRequestError(error));
    } finally {
      setSubmitting(false);
    }
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

  const fieldError = (field) =>
    formError?.field === field ? formError.message : "";

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

        <form className="reading-form" onSubmit={handleSubmit} noValidate>
          <h3>{editingId === null ? "Add a reading" : "Edit reading"}</h3>
          <ErrorMessage>{formError?.message}</ErrorMessage>
          <FormField
            id="date"
            label="Reading date"
            type="date"
            value={form.date}
            onChange={updateForm}
            error={fieldError("date")}
            required
          />
          <div className="form-field">
            <label htmlFor="slot">Time slot</label>
            <select
              id="slot"
              name="slot"
              value={form.slot}
              onChange={updateForm}
              aria-invalid={Boolean(fieldError("slot"))}
              aria-describedby={fieldError("slot") ? "slot-error" : undefined}
              required
            >
              <option value="">Select a time slot</option>
              {slots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
            {fieldError("slot") && (
              <span className="field-error" id="slot-error">
                {fieldError("slot")}
              </span>
            )}
          </div>
          <FormField
            id="value"
            label="Glucose value (mg/dl)"
            type="number"
            value={form.value}
            onChange={updateForm}
            error={fieldError("value")}
            required
          />
          <div className="form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
            {editingId !== null && (
              <button
                className="button button-secondary"
                type="button"
                onClick={cancelEditing}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
