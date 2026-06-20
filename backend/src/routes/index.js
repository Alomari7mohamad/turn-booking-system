import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import businessRoutes from "./business.routes.js";
import staffRoutes from "./staff.routes.js";
import publicRoutes from "./public.routes.js";
import paymentRoutes from "./payment.routes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ success: true, status: "ok" }));

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/business", businessRoutes);
router.use("/staff", staffRoutes);
router.use("/public", publicRoutes);
router.use("/payments", paymentRoutes);

export default router;
