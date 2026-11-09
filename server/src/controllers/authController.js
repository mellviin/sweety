import {
  changeUserPassword,
  getUserById,
  loginUser,
  logoutUser,
  registerUser,
} from "../services/authService.js";
import { getSafeRequestIp, recordSecurityEvent } from "../services/securityEventService.js";
import { logger, maskEmail } from "../utils/logger.js";

export function register(request, response, next) {
  registerUser(request.body)
    .then((result) => response.status(201).json(result))
    .catch(next);
}

export async function login(request, response, next) {
  let result;
  try {
    result = await loginUser(request.body);
  } catch (error) {
    if (error.status === 401) {
      try {
        await recordSecurityEvent(request, "login_failed");
      } catch (eventError) {
        return next(eventError);
      }

      logger.warn("auth_login_failed", {
        request_id: request.requestId,
        email: maskEmail(request.body.email),
        ip: getSafeRequestIp(request),
      });
    }

    return next(error);
  }

  try {
    await recordSecurityEvent(request, "login_success", result.user.id);
  } catch (error) {
    return next(error);
  }

  logger.info("auth_login_success", {
    request_id: request.requestId,
    user_id: result.user.id,
    email: maskEmail(request.body.email),
    ip: getSafeRequestIp(request),
  });
  return response.json(result);
}

export async function logout(request, response, next) {
  try {
    await logoutUser(request.user.id);
    await recordSecurityEvent(request, "logout", request.user.id);
  } catch (error) {
    return next(error);
  }

  logger.info("auth_logout", {
    request_id: request.requestId,
    user_id: request.user.id,
    ip: getSafeRequestIp(request),
  });
  return response.status(204).end();
}

export async function changePassword(request, response, next) {
  let result;
  try {
    result = await changeUserPassword(request.user.id, request.body);
    await recordSecurityEvent(request, "password_changed", request.user.id);
  } catch (error) {
    return next(error);
  }

  logger.info("auth_password_changed", {
    request_id: request.requestId,
    user_id: request.user.id,
    ip: getSafeRequestIp(request),
  });
  return response.json(result);
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
