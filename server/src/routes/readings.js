import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  create,
  get,
  list,
  remove,
  update,
} from "../controllers/readingsController.js";

const router = Router();

router.use(authenticateToken);
router.post("/", create);
router.get("/", list);
router.get("/:id", get);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
