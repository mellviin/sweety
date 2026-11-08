export function todayInTimezone(timezone) {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12) {
    return false;
  }

  return day >= 1 && day <= daysInMonth(year, month);
}

function daysInMonth(year, month) {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
}

function assertValidDateString(dateString) {
  if (!isValidDateString(dateString)) {
    throw new TypeError("Expected a valid date in YYYY-MM-DD format");
  }
}

export function firstOfMonth(dateString) {
  assertValidDateString(dateString);
  return `${dateString.slice(0, 7)}-01`;
}

export function previousMonthRange(dateString) {
  assertValidDateString(dateString);

  let year = Number(dateString.slice(0, 4));
  let month = Number(dateString.slice(5, 7)) - 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const monthString = String(month).padStart(2, "0");
  const lastDay = daysInMonth(year, month);

  return {
    startDate: `${String(year).padStart(4, "0")}-${monthString}-01`,
    endDate: `${String(year).padStart(4, "0")}-${monthString}-${String(lastDay).padStart(2, "0")}`,
  };
}
