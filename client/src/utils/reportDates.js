const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatReportDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return `${day} ${monthNames[month - 1]} ${year}`;
}

export function formatReportRange(from, to) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);

  if (from === to) {
    return formatReportDate(from);
  }

  if (fromYear === toYear) {
    return `${fromDay} ${monthNames[fromMonth - 1]} – ${toDay} ${monthNames[toMonth - 1]} ${toYear}`;
  }

  return `${formatReportDate(from)} – ${formatReportDate(to)}`;
}

export function formatReportAxisDate(dateString) {
  const [, month, day] = dateString.split("-").map(Number);
  return `${day} ${monthNames[month - 1]}`;
}
