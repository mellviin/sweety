import {
  getDailyReport,
  getMonthlyReport,
  getMonthToDateReport,
  getChartReadings,
} from "../services/reportService.js";

export function daily(request, response, next) {
  getDailyReport(request.user.id, request.query)
    .then((report) => response.json(report))
    .catch(next);
}

export function monthToDate(request, response, next) {
  getMonthToDateReport(request.user.id, request.query)
    .then((report) => response.json(report))
    .catch(next);
}

export function monthly(request, response, next) {
  getMonthlyReport(request.user.id, request.query)
    .then((report) => response.json(report))
    .catch(next);
}

export function chart(request, response, next) {
  getChartReadings(request.user.id, request.query)
    .then((readings) => response.json(readings))
    .catch(next);
}
