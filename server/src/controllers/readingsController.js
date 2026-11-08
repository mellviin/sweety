import {
  createReading,
  deleteReading,
  getReading,
  listReadings,
  updateReading,
} from "../services/readingService.js";

export function create(request, response, next) {
  createReading(request.user.id, request.body)
    .then((reading) => response.status(201).json(reading))
    .catch(next);
}

export function list(request, response, next) {
  listReadings(request.user.id, request.query)
    .then((result) => response.json(result))
    .catch(next);
}

export function get(request, response, next) {
  getReading(request.user.id, request.params.id)
    .then((reading) => response.json(reading))
    .catch(next);
}

export function update(request, response, next) {
  updateReading(request.user.id, request.params.id, request.body)
    .then((reading) => response.json(reading))
    .catch(next);
}

export function remove(request, response, next) {
  deleteReading(request.user.id, request.params.id)
    .then(() => response.status(204).end())
    .catch(next);
}
