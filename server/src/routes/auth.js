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
import { getPasswordValidationMessage } from "../services/passwordPolicy.js";

const router = Router();

const emailValidation = body("email")
  .isString()
  .withMessage("Email must be valid.")
  .bail()
  .trim()
  .isEmail()
  .withMessage("Email must be valid.")
  .bail()
  .customSanitizer((email) => email.toLowerCase());

router.post(
  "/register",
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
    const message = getPasswordValidationMessage(password, {
      name: req.body.name?.trim(),
      email: req.body.email?.trim().toLowerCase(),
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
  authRateLimiter,
  emailValidation,
  body("password")
    .isString()
    .withMessage("Invalid email or password."),
  validateRequest,
  failedLoginRateLimiter,
  login,
);

router.get("/me", authenticateToken, me);
router.post("/logout", authenticateToken, logout);
router.post(
  "/change-password",
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
