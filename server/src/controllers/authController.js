import {
  changeUserPassword,
  getUserById,
  loginUser,
  logoutUser,
  registerUser,
} from "../services/authService.js";

export function register(request, response, next) {
  registerUser(request.body)
    .then((result) => response.status(201).json(result))
    .catch(next);
}

export function login(request, response, next) {
  loginUser(request.body)
    .then((result) => response.json(result))
    .catch(next);
}

export function logout(request, response, next) {
  logoutUser(request.user.id)
    .then(() => response.status(204).end())
    .catch(next);
}

export function changePassword(request, response, next) {
  changeUserPassword(request.user.id, request.body)
    .then((result) => response.json(result))
    .catch(next);
}

export function me(request, response, next) {
  getUserById(request.user.id)
    .then((user) => {
      if (!user) {
        return response.status(401).json({
          error: {
            field: null,
            message: "Please log in to continue.",
          },
        });
      }

      return response.json({ user });
    })
    .catch(next);
}
