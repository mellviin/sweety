import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage.jsx";
import FormField from "../components/FormField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getRequestError } from "../utils/requestErrors.js";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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
    setFieldErrors({});
    setFormError("");

    if (values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      navigate("/dashboard", { replace: true });
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
      <section className="auth-card" aria-labelledby="register-title">
        <div className="auth-intro">
          <p className="eyebrow">A gentler way to keep track</p>
          <h1 id="register-title">Create your account</h1>
          <p>Your glucose log, all in one calm place.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <ErrorMessage>{formError}</ErrorMessage>
          <FormField
            id="name"
            label="Name"
            autoComplete="name"
            maxLength={100}
            value={values.name}
            onChange={updateField}
            error={fieldErrors.name}
            required
          />
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
            autoComplete="new-password"
            minLength={8}
            value={values.password}
            onChange={updateField}
            error={fieldErrors.password}
            required
          />
          <FormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={updateField}
            error={fieldErrors.confirmPassword}
            required
          />
          <button className="button button-primary button-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
