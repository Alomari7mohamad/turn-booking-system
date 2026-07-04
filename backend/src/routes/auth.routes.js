import { Router } from "express";
import { forgotPassword, login, me, resetPassword } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, me);
export default router;
