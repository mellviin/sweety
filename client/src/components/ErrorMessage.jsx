export default function ErrorMessage({ children, id }) {
  if (!children) {
    return null;
  }

  return (
    <div className="error-message" role="alert" id={id}>
      {children}
    </div>
  );
}
