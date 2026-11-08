import { Router } from "express";
import { daily, monthly, monthToDate } from "../controllers/reportController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.use(authenticateToken);
router.get("/daily", daily);
router.get("/month-to-date", monthToDate);
router.get("/monthly", monthly);

export default router;
