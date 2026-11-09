import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { readingWriteRateLimiter } from "../middleware/rateLimit.js";
import {
  create,
  get,
  list,
  remove,
  update,
} from "../controllers/readingsController.js";

const router = Router();

router.use(authenticateToken);
router.post("/", readingWriteRateLimiter, create);
router.get("/", list);
router.get("/:id", get);
router.put("/:id", readingWriteRateLimiter, update);
router.delete("/:id", readingWriteRateLimiter, remove);

export default router;
