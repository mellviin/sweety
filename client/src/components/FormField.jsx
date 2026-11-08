export default function FormField({
  id,
  label,
  type = "text",
  error,
  ...inputProps
}) {
  const errorId = `${id}-error`;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  );
}
