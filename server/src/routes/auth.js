import { Router } from "express";
import { body } from "express-validator";
import { login, me, register } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

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
  validateRequest,
  register,
);

router.post(
  "/login",
  emailValidation,
  body("password")
    .isString()
    .withMessage("Invalid email or password."),
  validateRequest,
  login,
);

router.get("/me", authenticateToken, me);

export default router;
