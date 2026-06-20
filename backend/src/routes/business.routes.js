import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { resolveTenant, requireTenant } from "../middleware/tenant.js";
import {
  getMyBusiness,
  updateMyBusiness,
  getDashboard,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeWorkingHours,
  setEmployeeWorkingHours,
  listServices,
  createService,
  updateService,
  deleteService,
  getWorkingHours,
  setWorkingHours,
  listBlockedTimes,
  createBlockedTime,
  deleteBlockedTime,
  listAppointments,
  updateAppointment,
  delayAppointment,
  cancelAppointment,
  updateAppointmentPayment,
  listAuditLogs,
  listNotifications,
  markNotificationsRead,
  deleteNotifications,
} from "../controllers/business.controller.js";

const router = Router();

// سلسلة الحماية: مصادقة -> دور صاحب المحل -> عزل المحل
router.use(authenticate, authorize("BUSINESS_OWNER"), resolveTenant, requireTenant);

router.get("/me", getMyBusiness);
router.patch("/me", updateMyBusiness);
router.get("/dashboard", getDashboard);

router.get("/employees", listEmployees);
router.post("/employees", createEmployee);
router.patch("/employees/:id", updateEmployee);
router.delete("/employees/:id", deleteEmployee);
router.get("/employees/:id/working-hours", getEmployeeWorkingHours);
router.put("/employees/:id/working-hours", setEmployeeWorkingHours);

router.get("/services", listServices);
router.post("/services", createService);
router.patch("/services/:id", updateService);
router.delete("/services/:id", deleteService);

router.get("/working-hours", getWorkingHours);
router.put("/working-hours", setWorkingHours);

router.get("/blocked-times", listBlockedTimes);
router.post("/blocked-times", createBlockedTime);
router.delete("/blocked-times/:id", deleteBlockedTime);

router.get("/appointments", listAppointments);
router.patch("/appointments/:id/payment", updateAppointmentPayment);
router.patch("/appointments/:id/delay", delayAppointment);
router.patch("/appointments/:id", updateAppointment);
router.delete("/appointments/:id", cancelAppointment);

router.get("/audit-logs", listAuditLogs);
router.get("/notifications", listNotifications);
router.patch("/notifications/read", markNotificationsRead);
router.delete("/notifications", deleteNotifications);

export default router;
