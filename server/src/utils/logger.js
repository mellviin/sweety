const permittedFields = [
  "request_id",
  "method",
  "status",
  "field",
  "user_id",
  "email",
  "ip",
  "user_agent",
  "event_type",
  "limiter",
  "reason",
  "port",
];

export function sanitizeLogValue(value, maxLength = 256) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function maskEmail(value) {
  const email = sanitizeLogValue(value, 254);
  if (typeof email !== "string") {
    return "***";
  }

  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) {
    return "***";
  }

  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${localPart[0]}***@${domain}`;
}

export function createLogger(writeLine = (line) => process.stdout.write(line)) {
  function write(level, event, fields = {}) {
    const record = {
      time: new Date().toISOString(),
      level,
      event: sanitizeLogValue(event, 80),
    };

    const safeFields = Object.entries(fields).flatMap(([field, value]) => {
      if (!permittedFields.includes(field) || value === undefined || value === null) {
        return [];
      }

      if (field === "email") {
        return [[field, maskEmail(value)]];
      }

      if (typeof value === "string") {
        return [[field, sanitizeLogValue(value, field === "user_agent" ? 512 : 256)]];
      }

      if (
        (field === "user_id" || field === "status" || field === "port")
        && Number.isSafeInteger(value)
      ) {
        return [[field, value]];
      }

      return [];
    });

    Object.assign(record, Object.fromEntries(safeFields));

    writeLine(`${JSON.stringify(record)}\n`);
  }

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export const logger = createLogger();
