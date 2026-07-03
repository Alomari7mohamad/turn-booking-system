import { Router } from "express";
import {
  getPublicBusiness,
  getPublicAvailability,
  createPublicAppointment,
  findAppointmentByPhone,
  updatePublicCustomerProfile,
  cancelPublicAppointment,
  getPrintTicket,
  respondToDelay,
  getAppointmentStatus,
  getPublicReview,
  submitPublicReview,
  sendPhoneVerification,
  confirmPhoneVerification,
} from "../controllers/public.controller.js";

// مسارات عامة بدون مصادقة — العزل يتم عبر slug المحل.
const router = Router();
router.get("/appointments/:id/status", getAppointmentStatus);
router.post("/appointments/:id/delay-response", respondToDelay);
router.get("/reviews/:token", getPublicReview);
router.post("/reviews/:token", submitPublicReview);
router.get("/:slug", getPublicBusiness);
router.get("/:slug/availability", getPublicAvailability);
router.get("/:slug/appointments/by-phone", findAppointmentByPhone);
router.patch("/:slug/customer-profile", updatePublicCustomerProfile);
router.get("/:slug/print-ticket", getPrintTicket);
router.post("/:slug/phone-verifications", sendPhoneVerification);
router.post("/:slug/phone-verifications/confirm", confirmPhoneVerification);
router.post("/:slug/appointments", createPublicAppointment);
router.delete("/:slug/appointments/:id", cancelPublicAppointment);
export default router;
