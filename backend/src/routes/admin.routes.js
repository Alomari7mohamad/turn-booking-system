import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { ApiError } from "../utils/ApiError.js";
import {
  getStats,
  getAnalytics,
  listBusinesses,
  listManagers,
  createManager,
  updateManager,
  getBusiness,
  createBusiness,
  updateBusiness,
  toggleBusinessStatus,
  updateSubscription,
  upsertOwner,
  overrideAppointmentPayment,
} from "../controllers/admin.controller.js";
import {
  getMyBusiness,
  updateMyBusiness,
  getDashboard,
  listCustomers,
  updateCustomerSettings,
  listCustomerReviews,
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
  createAppointmentReviewLink,
  delayAppointment,
  getAppointmentRequeueOptions,
  requeueAppointment,
  cancelAppointment,
  listAuditLogs,
  listNotifications,
  markNotificationsRead,
  deleteNotifications,
  secretaryToday,
  secretaryLateTicket,
  openSecretarySession,
} from "../controllers/business.controller.js";

const router = Router();

// كل مسارات الأدمن تتطلّب SUPER_ADMIN
router.use(authenticate, authorize("SUPER_ADMIN"));

const resolveManagedBusiness = (req, _res, next) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId)) {
    return next(ApiError.badRequest("معرّف المحل غير صالح"));
  }
  req.tenantId = businessId;
  next();
};

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/managers", listManagers);
router.post("/managers", createManager);
router.patch("/managers/:id", updateManager);
router.get("/businesses", listBusinesses);
router.post("/businesses", createBusiness);
router.get("/businesses/:id", getBusiness);
router.patch("/businesses/:id", updateBusiness);
router.patch("/businesses/:id/status", toggleBusinessStatus);
router.patch("/businesses/:id/subscription", updateSubscription);
router.patch("/businesses/:id/owner", upsertOwner);
router.patch("/appointments/:id/payment", overrideAppointmentPayment);

router.use("/businesses/:businessId/manage", resolveManagedBusiness);
router.get("/businesses/:businessId/manage/me", getMyBusiness);
router.patch("/businesses/:businessId/manage/me", updateMyBusiness);
router.get("/businesses/:businessId/manage/dashboard", getDashboard);
router.get("/businesses/:businessId/manage/customers", listCustomers);
router.patch("/businesses/:businessId/manage/customers/settings", updateCustomerSettings);
router.get("/businesses/:businessId/manage/customers/:phone/reviews", listCustomerReviews);

router.get("/businesses/:businessId/manage/employees", listEmployees);
router.post("/businesses/:businessId/manage/employees", createEmployee);
router.patch("/businesses/:businessId/manage/employees/:id", updateEmployee);
router.delete("/businesses/:businessId/manage/employees/:id", deleteEmployee);
router.get("/businesses/:businessId/manage/employees/:id/working-hours", getEmployeeWorkingHours);
router.put("/businesses/:businessId/manage/employees/:id/working-hours", setEmployeeWorkingHours);

router.get("/businesses/:businessId/manage/services", listServices);
router.post("/businesses/:businessId/manage/services", createService);
router.patch("/businesses/:businessId/manage/services/:id", updateService);
router.delete("/businesses/:businessId/manage/services/:id", deleteService);

router.get("/businesses/:businessId/manage/working-hours", getWorkingHours);
router.put("/businesses/:businessId/manage/working-hours", setWorkingHours);

router.get("/businesses/:businessId/manage/blocked-times", listBlockedTimes);
router.post("/businesses/:businessId/manage/blocked-times", createBlockedTime);
router.delete("/businesses/:businessId/manage/blocked-times/:id", deleteBlockedTime);

router.get("/businesses/:businessId/manage/appointments", listAppointments);
router.patch("/businesses/:businessId/manage/appointments/:id/payment", overrideAppointmentPayment);
router.post("/businesses/:businessId/manage/appointments/:id/review-link", createAppointmentReviewLink);
router.patch("/businesses/:businessId/manage/appointments/:id/delay", delayAppointment);
router.get("/businesses/:businessId/manage/appointments/:id/requeue-options", getAppointmentRequeueOptions);
router.patch("/businesses/:businessId/manage/appointments/:id/requeue", requeueAppointment);
router.patch("/businesses/:businessId/manage/appointments/:id", updateAppointment);
router.delete("/businesses/:businessId/manage/appointments/:id", cancelAppointment);

router.get("/businesses/:businessId/manage/secretary/today", secretaryToday);
router.post("/businesses/:businessId/manage/secretary/late-ticket", secretaryLateTicket);
router.post("/businesses/:businessId/manage/secretary/session", openSecretarySession);

router.get("/businesses/:businessId/manage/audit-logs", listAuditLogs);
router.get("/businesses/:businessId/manage/notifications", listNotifications);
router.patch("/businesses/:businessId/manage/notifications/read", markNotificationsRead);
router.delete("/businesses/:businessId/manage/notifications", deleteNotifications);

export default router;
