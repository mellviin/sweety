import { Router } from "express";
import { body } from "express-validator";
import {
  changePassword,
  login,
  logout,
  me,
  register,
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  authRateLimiter,
  failedLoginRateLimiter,
} from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";
import { strictFields } from "../middleware/strictFields.js";
import { getPasswordValidationMessage } from "../services/passwordPolicy.js";

const router = Router();

const emailValidation = body("email")
  .isString()
  .withMessage("Email must be valid.")
  .bail()
  .isLength({ max: 254 })
  .withMessage("Email must be valid.")
  .bail()
  .trim()
  .isEmail()
  .withMessage("Email must be valid.")
  .bail()
  .customSanitizer((email) => email.toLowerCase());

router.post(
  "/register",
  strictFields("body", ["name", "email", "password"]),
  strictFields("query", []),
  authRateLimiter,
  body("name")
    .isString()
    .withMessage("Name is required.")
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters."),
  emailValidation,
  body("password")
    .isString()
    .withMessage("Password must be at least 8 characters.")
    .bail()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
  body("password").custom((password, { req }) => {
    const name = typeof req.body.name === "string"
      ? req.body.name.trim()
      : undefined;
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : undefined;
    const message = getPasswordValidationMessage(password, {
      name,
      email,
    });
    if (message) {
      throw new Error(message);
    }
    return true;
  }),
  validateRequest,
  register,
);

router.post(
  "/login",
  strictFields("body", ["email", "password"]),
  strictFields("query", []),
  authRateLimiter,
  emailValidation,
  body("password")
    .isString()
    .withMessage("Invalid email or password."),
  validateRequest,
  failedLoginRateLimiter,
  login,
);

router.get(
  "/me",
  strictFields("body", []),
  strictFields("query", []),
  authenticateToken,
  me,
);
router.post(
  "/logout",
  strictFields("body", []),
  strictFields("query", []),
  authenticateToken,
  logout,
);
router.post(
  "/change-password",
  strictFields("body", ["currentPassword", "newPassword"]),
  strictFields("query", []),
  authenticateToken,
  body("currentPassword")
    .isString()
    .withMessage("Current password is required.")
    .bail()
    .notEmpty()
    .withMessage("Current password is required."),
  body("newPassword").custom((password) => {
    const message = getPasswordValidationMessage(password);
    if (message) {
      throw new Error(message);
    }
    return true;
  }),
  validateRequest,
  changePassword,
);

export default router;
