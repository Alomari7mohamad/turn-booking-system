import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { resolveTenant, requireTenant } from "../middleware/tenant.js";
import {
  getRequeueOptions,
  listStaffEmployees,
  myAppointments,
  createStaffAppointmentReviewLink,
  requeueAppointment,
  updateMyAppointmentStatus,
  updateStaffAppointmentPayment,
} from "../controllers/staff.controller.js";

const router = Router();
router.use(authenticate, authorize("STAFF"), resolveTenant, requireTenant);

router.get("/appointments", myAppointments);
router.get("/employees", listStaffEmployees);
router.post("/appointments/:id/review-link", createStaffAppointmentReviewLink);
router.get("/appointments/:id/requeue-options", getRequeueOptions);
router.patch("/appointments/:id/requeue", requeueAppointment);
router.patch("/appointments/:id/status", updateMyAppointmentStatus);
router.patch("/appointments/:id/payment", updateStaffAppointmentPayment);

export default router;
