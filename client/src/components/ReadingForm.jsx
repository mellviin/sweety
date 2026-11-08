import { useEffect, useState } from "react";
import ErrorMessage from "./ErrorMessage.jsx";
import FormField from "./FormField.jsx";
import { api } from "../api/client.js";
import { getRequestError } from "../utils/requestErrors.js";
import { slots } from "../utils/slots.js";

function emptyForm(date) {
  return { date, slot: "", value: "" };
}

export default function ReadingForm({
  selectedDate,
  reading = null,
  onCancel,
  onSaved,
}) {
  const [form, setForm] = useState(() => reading
    ? { date: reading.date, slot: reading.slot, value: String(reading.value) }
    : emptyForm(selectedDate));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const isEditing = reading !== null;

  useEffect(() => {
    setForm(reading
      ? { date: reading.date, slot: reading.slot, value: String(reading.value) }
      : emptyForm(selectedDate));
    setFormError(null);
  }, [reading, selectedDate]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function cancelEditing() {
    setForm(emptyForm(selectedDate));
    setFormError(null);
    onCancel();
  }

  const fieldError = (field) =>
    formError?.field === field ? formError.message : "";

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    if (form.value.trim() === "") {
      setFormError({ field: "value", message: "Please enter a glucose value." });
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing) {
        await api.put(`/readings/${reading.id}`, form);
      } else {
        await api.post("/readings", form);
      }

      setForm(emptyForm(selectedDate));
      setFormError(null);
      onCancel();
      await onSaved();
    } catch (error) {
      setFormError(getRequestError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="reading-form" onSubmit={handleSubmit} noValidate>
      <h3>{isEditing ? "Edit reading" : "Add a reading"}</h3>
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
        {isEditing && (
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
  );
}
