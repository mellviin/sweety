import { useState } from "react";
import ErrorMessage from "../components/ErrorMessage.jsx";
import FormField from "../components/FormField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getRequestError } from "../utils/requestErrors.js";

export default function Profile() {
  const { changePassword } = useAuth();
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (values.newPassword !== values.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password updated.");
    } catch (requestError) {
      setError(getRequestError(requestError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="auth-card" aria-labelledby="profile-title">
        <div className="auth-intro">
          <p className="eyebrow">Account security</p>
          <h1 id="profile-title">Change password</h1>
          <p>Choose a password that is unique to your account.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <ErrorMessage>{error}</ErrorMessage>
          {message && <p role="status">{message}</p>}
          <FormField
            id="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={updateField}
            required
          />
          <FormField
            id="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={values.newPassword}
            onChange={updateField}
            required
          />
          <FormField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={updateField}
            required
          />
          <button className="button button-primary button-full" disabled={submitting}>
            {submitting ? "Updating password…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
