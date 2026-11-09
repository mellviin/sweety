import { Router } from "express";
import {
  chart,
  daily,
  monthly,
  monthToDate,
} from "../controllers/reportController.js";
import { authenticateToken } from "../middleware/auth.js";
import { strictFields } from "../middleware/strictFields.js";

const router = Router();

router.use(authenticateToken);
router.get("/daily", strictFields("body", []), strictFields("query", ["date"]), daily);
router.get(
  "/month-to-date",
  strictFields("body", []),
  strictFields("query", ["date"]),
  monthToDate,
);
router.get("/monthly", strictFields("body", []), strictFields("query", ["date"]), monthly);
router.get("/chart", strictFields("body", []), strictFields("query", ["date"]), chart);

export default router;
