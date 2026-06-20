import { Router } from "express";
import {
  getPublicBusiness,
  getPublicAvailability,
  createPublicAppointment,
  respondToDelay,
  getAppointmentStatus,
} from "../controllers/public.controller.js";

// مسارات عامة بدون مصادقة — العزل يتم عبر slug المحل.
const router = Router();
router.get("/appointments/:id/status", getAppointmentStatus);
router.post("/appointments/:id/delay-response", respondToDelay);
router.get("/:slug", getPublicBusiness);
router.get("/:slug/availability", getPublicAvailability);
router.post("/:slug/appointments", createPublicAppointment);
export default router;
