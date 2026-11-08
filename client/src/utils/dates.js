export function todayInTimezone(
  timezone = import.meta.env.VITE_APP_TIMEZONE ?? "Asia/Kolkata",
) {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
