import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { resolveTenant, requireTenant } from "../middleware/tenant.js";
import { myAppointments, updateMyAppointmentStatus } from "../controllers/staff.controller.js";

const router = Router();
router.use(authenticate, authorize("STAFF"), resolveTenant, requireTenant);

router.get("/appointments", myAppointments);
router.patch("/appointments/:id/status", updateMyAppointmentStatus);

export default router;
