import { commonPasswords } from "./commonPasswords.js";

export function getPasswordValidationMessage(password, { email, name } = {}) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 72 || Buffer.byteLength(password, "utf8") > 72) {
    return "Password must be no more than 72 characters.";
  }
  if (commonPasswords.has(password.toLowerCase())) {
    return "Choose a less common password.";
  }
  const normalizedPassword = password.trim().toLowerCase();
  if (
    (email && normalizedPassword === email.trim().toLowerCase())
    || (name && normalizedPassword === name.trim().toLowerCase())
  ) {
    return "Password must not match your email or name.";
  }
  return null;
}

export function assertPasswordPolicy(password, userDetails, field = "password") {
  const message = getPasswordValidationMessage(password, userDetails);
  if (message) {
    const error = new Error(message);
    error.status = 400;
    error.field = field;
    throw error;
  }
}
