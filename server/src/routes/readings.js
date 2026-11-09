import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { readingWriteRateLimiter } from "../middleware/rateLimit.js";
import { strictFields } from "../middleware/strictFields.js";
import {
  create,
  get,
  list,
  remove,
  update,
} from "../controllers/readingsController.js";

const router = Router();

router.use(authenticateToken);
router.post(
  "/",
  strictFields("body", ["date", "slot", "value"]),
  strictFields("query", []),
  readingWriteRateLimiter,
  create,
);
router.get(
  "/",
  strictFields("body", []),
  strictFields("query", ["date", "page", "limit"]),
  list,
);
router.get("/:id", strictFields("body", []), strictFields("query", []), get);
router.put(
  "/:id",
  strictFields("body", ["date", "slot", "value"]),
  strictFields("query", []),
  readingWriteRateLimiter,
  update,
);
router.delete(
  "/:id",
  strictFields("body", []),
  strictFields("query", []),
  readingWriteRateLimiter,
  remove,
);

export default router;
