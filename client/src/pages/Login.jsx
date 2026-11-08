import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage.jsx";
import FormField from "../components/FormField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getRequestError } from "../utils/requestErrors.js";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: "" }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError("");

    try {
      await login(values);
      navigate(location.state?.from?.pathname ?? "/dashboard", { replace: true });
    } catch (error) {
      const requestError = getRequestError(error);
      setFieldErrors(requestError.field ? { [requestError.field]: requestError.message } : {});
      setFormError(requestError.field ? "" : requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-intro">
          <p className="eyebrow">Welcome back</p>
          <h1 id="login-title">Log in to Sweety</h1>
          <p>Your readings are waiting for you.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <ErrorMessage>{formError}</ErrorMessage>
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={updateField}
            error={fieldErrors.email}
            required
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={updateField}
            error={fieldErrors.password}
            required
          />
          <button className="button button-primary button-full" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          New to Sweety? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
