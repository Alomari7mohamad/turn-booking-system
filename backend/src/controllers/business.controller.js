import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { dayBounds } from "../utils/time.js";
import { assertSlotAvailable, getAvailability } from "../services/availability.service.js";
import { logAudit, AUDIT } from "../services/audit.service.js";
import { recordCustomerPayment } from "../services/customer.service.js";
import { ensureAppointmentReviewToken, sendAppointmentReviewLink } from "../services/review.service.js";
import { publicAppUrl } from "../services/whatsapp.service.js";
import { ensureImageColumnsCapacity } from "../services/databaseMaintenance.service.js";

// …„״§״­״¸״©: req.tenantId ״£״× …† middleware ״§„״¹״²„״ ˆƒ„ ״§״³״×״¹„״§… ‡†״§ …‚‘״¯ ״¨‡.

// ============ ״¨״§†״§״× ״§„…״­„ ============
// GET /api/business/me
export const getMyBusiness = asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.tenantId },
    include: {
      _count: { select: { employees: true, services: true, appointments: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!business) throw ApiError.notFound("״§„…״­„ ״÷״± …ˆ״¬ˆ״¯");
  res.json({ success: true, business });
});

// PATCH /api/business/me
export const updateMyBusiness = asyncHandler(async (req, res) => {
  const existing = await prisma.business.findUnique({ where: { id: req.tenantId } });
  if (!existing) throw ApiError.notFound("Business not found");
  if (req.body.logoUrl !== undefined || req.body.bookingHeroImageUrl !== undefined) {
    await ensureImageColumnsCapacity(prisma);
  }

  const data = {};
  const businessInfoKeys = ["name", "email", "phone", "address", "mapUrl", "logoUrl", "bookingHeroImageUrl", "brandColor", "timezone"];
  businessInfoKeys.forEach((k) => {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  });

  const paymentKeys = ["onlinePaymentEnabled", "payAtStoreEnabled"];
  if (req.body.customerHubEnabled !== undefined) data.customerHubEnabled = Boolean(req.body.customerHubEnabled);
  const paymentChanged = paymentKeys.some((k) => req.body[k] !== undefined && existing[k] !== Boolean(req.body[k]));
  const businessInfoChanges = businessInfoKeys.filter((k) => {
    if (req.body[k] === undefined) return false;
    return String(existing[k] ?? "") !== String(req.body[k] ?? "");
  });

  paymentKeys.forEach((k) => {
    if (req.body[k] !== undefined) data[k] = Boolean(req.body[k]);
  });
  const business = await prisma.business.update({ where: { id: req.tenantId }, data });

  if (paymentChanged) {
    await logAudit({
      businessId: req.tenantId,
      userId: req.user.id,
      actorName: req.user.name,
      action: AUDIT.PAYMENT_SETTINGS_CHANGED,
      entityType: "Business",
      entityId: req.tenantId,
      meta: { onlinePaymentEnabled: business.onlinePaymentEnabled, payAtStoreEnabled: business.payAtStoreEnabled },
    });
  }
  if (businessInfoChanges.length) {
    await logAudit({
      businessId: req.tenantId,
      userId: req.user.id,
      actorName: req.user.name,
      action: AUDIT.BUSINESS_SETTINGS_CHANGED,
      entityType: "Business",
      entityId: req.tenantId,
      meta: { changes: businessInfoChanges },
    });
  }
  res.json({ success: true, business });
});

// GET /api/business/dashboard ג€” …„״®‘״µ „ˆ״­״© ״§„…״­„
export const getDashboard = asyncHandler(async (req, res) => {
  const businessId = req.tenantId;
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = dayBounds(today);

  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [todayCount, weekCount, employees, services, upcoming] = await Promise.all([
    prisma.appointment.count({
      where: { businessId, startAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    }),
    prisma.appointment.count({
      where: { businessId, startAt: { gte: start, lt: weekEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.employee.count({ where: { businessId, isActive: true } }),
    prisma.service.count({ where: { businessId, isActive: true } }),
    prisma.appointment.findMany({
      where: { businessId, startAt: { gte: new Date() }, status: "PENDING" },
      orderBy: { startAt: "asc" },
      take: 6,
      include: { service: { select: { name: true } }, employee: { select: { name: true } } },
    }),
  ]);

  res.json({
    success: true,
    stats: { todayCount, weekCount, employees, services },
    upcoming,
  });
});

function normalizeCustomerPhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "").trim();
}

function customerMonthBounds(month) {
  const base = month && /^\d{4}-\d{2}$/.test(month)
    ? new Date(`${month}-01T00:00:00`)
    : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return { start, end, key: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}` };
}

export const listCustomers = asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.tenantId },
    select: { customerHubEnabled: true, customerPointsPercent: true },
  });
  if (!business?.customerHubEnabled) {
    return res.json({
      success: true,
      enabled: false,
      customerPointsPercent: business?.customerPointsPercent || 0,
      customers: [],
      summary: { customers: 0, monthlyVisits: 0, monthlyPaid: 0, points: 0 },
    });
  }

  const { start, end, key } = customerMonthBounds(req.query.month);
  const [customers, appointments] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: req.tenantId },
      orderBy: [{ lastVisitAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.appointment.findMany({
      where: {
        businessId: req.tenantId,
        startAt: { gte: start, lt: end },
        status: { not: "CANCELLED" },
      },
      select: {
        customerPhone: true,
        paymentStatus: true,
        paymentAmount: true,
        paymentMethod: true,
        status: true,
      },
    }),
  ]);

  const monthlyByPhone = new Map();
  appointments.forEach((appointment) => {
    const phone = normalizeCustomerPhone(appointment.customerPhone);
    if (!phone) return;
    const item = monthlyByPhone.get(phone) || { visits: 0, paid: 0, noShow: 0 };
    item.visits += 1;
    if (appointment.status === "NO_SHOW") item.noShow += 1;
    if (appointment.paymentStatus === "PAID" && !(appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE")) {
      item.paid += Number(appointment.paymentAmount || 0);
    }
    monthlyByPhone.set(phone, item);
  });

  const rows = customers.map((customer) => {
    const monthly = monthlyByPhone.get(normalizeCustomerPhone(customer.phone)) || { visits: 0, paid: 0, noShow: 0 };
    return { ...customer, monthly };
  });

  res.json({
    success: true,
    enabled: true,
    month: key,
    customerPointsPercent: business.customerPointsPercent || 0,
    customers: rows,
    summary: {
      customers: rows.length,
      monthlyVisits: rows.reduce((sum, customer) => sum + customer.monthly.visits, 0),
      monthlyPaid: rows.reduce((sum, customer) => sum + customer.monthly.paid, 0),
      points: rows.reduce((sum, customer) => sum + Number(customer.points || 0), 0),
    },
  });
});

export const updateCustomerSettings = asyncHandler(async (req, res) => {
  const percent = Number(req.body.customerPointsPercent || 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw ApiError.badRequest("نسبة النقاط يجب أن تكون بين 0 و 100");
  }
  const business = await prisma.business.update({
    where: { id: req.tenantId },
    data: { customerPointsPercent: percent },
    select: { customerHubEnabled: true, customerPointsPercent: true },
  });
  res.json({ success: true, business });
});

export const listCustomerReviews = asyncHandler(async (req, res) => {
  const phone = normalizeCustomerPhone(req.params.phone);
  if (phone.length < 6) throw ApiError.badRequest("رقم الهاتف غير صالح");

  const appointments = await prisma.appointment.findMany({
    where: { businessId: req.tenantId },
    select: { id: true, customerPhone: true },
  });
  const appointmentIds = appointments
    .filter((appointment) => normalizeCustomerPhone(appointment.customerPhone) === phone)
    .map((appointment) => appointment.id);

  if (!appointmentIds.length) {
    return res.json({ success: true, reviews: [] });
  }

  const reviews = await prisma.review.findMany({
    where: { businessId: req.tenantId, appointmentId: { in: appointmentIds } },
    orderBy: { createdAt: "desc" },
    include: {
      appointment: { select: { id: true, customerName: true, customerPhone: true, startAt: true } },
      service: { select: { name: true } },
      employee: { select: { name: true, title: true } },
    },
  });
  res.json({ success: true, reviews });
});

// ============ ״§„…ˆ״¸ˆ† ============
// GET /api/business/employees
export const listEmployees = asyncHandler(async (req, res) => {
  const employees = await prisma.employee.findMany({
    where: { businessId: req.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      services: { select: { serviceId: true } },
      user: { select: { id: true, email: true } },
    },
  });
  res.json({
    success: true,
    employees: employees.map((e) => ({
      ...e,
      serviceIds: e.services.map((s) => s.serviceId),
    })),
  });
});

// POST /api/business/employees ג€” ״¯״¹… ״¥†״´״§״¡ ״­״³״§״¨ ״¯״®ˆ„ STAFF ״§״®״×״§״±‹״§
export const createEmployee = asyncHandler(async (req, res) => {
  const { name, phone, title, role = "PROVIDER", serviceIds = [], loginEmail, loginPassword } = req.body;
  if (!name) throw ApiError.badRequest("״§״³… ״§„…ˆ״¸ …״·„ˆ״¨");

  const employee = await prisma.$transaction(async (tx) => {
    let userId = null;
    if (loginEmail && loginPassword) {
      const taken = await tx.user.findUnique({ where: { email: loginEmail.toLowerCase().trim() } });
      if (taken) throw ApiError.conflict("״¨״±״¯ ״§„…ˆ״¸ …״³״×״®״¯… …״³״¨‚‹״§");
      const u = await tx.user.create({
        data: {
          businessId: req.tenantId,
          name,
          email: loginEmail.toLowerCase().trim(),
          passwordHash: await hashPassword(loginPassword),
          role: "STAFF",
        },
      });
      userId = u.id;
    }

    const emp = await tx.employee.create({
      data: { businessId: req.tenantId, name, phone, title, role, userId, loginPassword: loginPassword || null },
    });

    if (serviceIds.length) {
      // ״×״£ƒ״¯ ״£† ״§„״®״¯…״§״× ״×״®״µ †״³ ״§„…״­„ (״¹״²„)
      const valid = await tx.service.findMany({
        where: { id: { in: serviceIds.map(Number) }, businessId: req.tenantId },
        select: { id: true },
      });
      await tx.employeeService.createMany({
        data: valid.map((s) => ({ employeeId: emp.id, serviceId: s.id })),
      });
    }
    return emp;
  });

  res.status(201).json({ success: true, employee });
});

// PATCH /api/business/employees/:id
export const updateEmployee = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.employee.findFirst({
    where: { id, businessId: req.tenantId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) throw ApiError.notFound("״§„…ˆ״¸ ״÷״± …ˆ״¬ˆ״¯");

  const { name, phone, title, role, isActive, serviceIds, loginEmail, loginPassword } = req.body;

  await prisma.$transaction(async (tx) => {
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (title !== undefined) data.title = title;
    if (role !== undefined) data.role = role || "PROVIDER";
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (loginPassword !== undefined) data.loginPassword = loginPassword || null;

    const normalizedEmail = loginEmail ? loginEmail.toLowerCase().trim() : "";
    const shouldCreateLogin = normalizedEmail && loginPassword && !existing.userId;
    if (shouldCreateLogin) {
      const taken = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (taken) throw ApiError.conflict("״¨״±״¯ ״§„…ˆ״¸ …״³״×״®״¯… …״³״¨‚‹״§");
      const u = await tx.user.create({
        data: {
          businessId: req.tenantId,
          name: name ?? existing.name,
          email: normalizedEmail,
          passwordHash: await hashPassword(loginPassword),
          role: "STAFF",
        },
      });
      data.userId = u.id;
    } else if (existing.userId) {
      const userData = {};
      if (name !== undefined) userData.name = name;
      if (normalizedEmail && normalizedEmail !== existing.user?.email) {
        const taken = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (taken && taken.id !== existing.userId) throw ApiError.conflict("״¨״±״¯ ״§„…ˆ״¸ …״³״×״®״¯… …״³״¨‚‹״§");
        userData.email = normalizedEmail;
      }
      if (loginPassword) userData.passwordHash = await hashPassword(loginPassword);
      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
      }
    }

    await tx.employee.update({ where: { id }, data });

    if (Array.isArray(serviceIds)) {
      await tx.employeeService.deleteMany({ where: { employeeId: id } });
      const valid = await tx.service.findMany({
        where: { id: { in: serviceIds.map(Number) }, businessId: req.tenantId },
        select: { id: true },
      });
      if (valid.length) {
        await tx.employeeService.createMany({
          data: valid.map((s) => ({ employeeId: id, serviceId: s.id })),
        });
      }
    }
  });

  res.json({ success: true });
});

// DELETE /api/business/employees/:id
export const deleteEmployee = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.employee.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„…ˆ״¸ ״÷״± …ˆ״¬ˆ״¯");
  await prisma.employee.delete({ where: { id } });
  res.json({ success: true });
});

// ============ ״§„״®״¯…״§״× ============
// GET /api/business/services
export const listServices = asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({
    where: { businessId: req.tenantId },
    orderBy: { createdAt: "desc" },
    include: { workingHours: { orderBy: { dayOfWeek: "asc" } } },
  });
  res.json({ success: true, services });
});

// POST /api/business/services
export const createService = asyncHandler(async (req, res) => {
  const { name, description, imageUrl, durationMinutes, price, serviceHours = [] } = req.body;
  if (!name || !durationMinutes) throw ApiError.badRequest("Service name and duration are required");
  if (imageUrl !== undefined) await ensureImageColumnsCapacity(prisma);
  const service = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        businessId: req.tenantId,
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        durationMinutes: Number(durationMinutes),
        price: price ? Number(price) : 0,
      },
    });
    if (Array.isArray(serviceHours) && serviceHours.length) {
      await tx.workingHours.createMany({
        data: serviceHours.map((d) => ({
          businessId: req.tenantId,
          serviceId: created.id,
          employeeId: null,
          dayOfWeek: Number(d.dayOfWeek),
          startTime: d.startTime || "09:00",
          endTime: d.endTime || "17:00",
          breakStartTime: d.breakStartTime || null,
          breakEndTime: d.breakEndTime || null,
          isClosed: Boolean(d.isClosed),
        })),
      });
    }
    return tx.service.findUnique({ where: { id: created.id }, include: { workingHours: { orderBy: { dayOfWeek: "asc" } } } });
  });
  res.status(201).json({ success: true, service });
});

// PATCH /api/business/services/:id
export const updateService = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.service.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("Service not found");
  if (req.body.imageUrl !== undefined) await ensureImageColumnsCapacity(prisma);

  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.description !== undefined) data.description = req.body.description;
  if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl || null;
  if (req.body.durationMinutes !== undefined) data.durationMinutes = Number(req.body.durationMinutes);
  if (req.body.price !== undefined) data.price = Number(req.body.price);
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

  const service = await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data });
    if (Array.isArray(req.body.serviceHours)) {
      await tx.workingHours.deleteMany({ where: { businessId: req.tenantId, serviceId: id, employeeId: null } });
      if (req.body.serviceHours.length) {
        await tx.workingHours.createMany({
          data: req.body.serviceHours.map((d) => ({
            businessId: req.tenantId,
            serviceId: id,
            employeeId: null,
            dayOfWeek: Number(d.dayOfWeek),
            startTime: d.startTime || "09:00",
            endTime: d.endTime || "17:00",
            breakStartTime: d.breakStartTime || null,
            breakEndTime: d.breakEndTime || null,
            isClosed: Boolean(d.isClosed),
          })),
        });
      }
    }
    return tx.service.findUnique({ where: { id }, include: { workingHours: { orderBy: { dayOfWeek: "asc" } } } });
  });
  res.json({ success: true, service });
});

// DELETE /api/business/services/:id
export const deleteService = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.service.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„״®״¯…״© ״÷״± …ˆ״¬ˆ״¯״©");
  await prisma.service.delete({ where: { id } });
  res.json({ success: true });
});

// ============ ״³״§״¹״§״× ״§„״¹…„ ============
// GET /api/business/working-hours  (״¯ˆ״§… ״§„…״­„ ״§„״¹״§…: employeeId = null)
export const getWorkingHours = asyncHandler(async (req, res) => {
  const hours = await prisma.workingHours.findMany({
    where: { businessId: req.tenantId, employeeId: null, serviceId: null },
    orderBy: { dayOfWeek: "asc" },
  });
  res.json({ success: true, workingHours: hours });
});

// PUT /api/business/working-hours  (״§״³״×״¨״¯״§„ ƒ״§…„ „״¬״¯ˆ„ ״§„״¯ˆ״§… ״§„״¹״§…)
export const setWorkingHours = asyncHandler(async (req, res) => {
  const { days } = req.body; // [{dayOfWeek, startTime, endTime, isClosed}]
  if (!Array.isArray(days)) throw ApiError.badRequest("״µ״÷״© ״§„״£״§… ״÷״± ״µ״­״­״©");

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { businessId: req.tenantId, employeeId: null, serviceId: null } });
    const normalizedDays = days.map((d) => ({
        businessId: req.tenantId,
        employeeId: null,
        serviceId: null,
        dayOfWeek: Number(d.dayOfWeek),
        startTime: d.startTime || "09:00",
        endTime: d.endTime || "17:00",
        breakStartTime: d.breakStartTime || null,
        breakEndTime: d.breakEndTime || null,
        isClosed: Boolean(d.isClosed),
      }));

    await tx.workingHours.createMany({
      data: normalizedDays,
    });

    await Promise.all(
      normalizedDays.map((day) =>
        tx.workingHours.updateMany({
          where: {
            businessId: req.tenantId,
            employeeId: null,
            serviceId: { not: null },
            dayOfWeek: day.dayOfWeek,
          },
          data: { isClosed: day.isClosed },
        })
      )
    );
  });

  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.WORKING_HOURS_CHANGED,
    entityType: "WorkingHours",
    meta: { days: days.length },
  });

  res.json({ success: true });
});

// ============ ״§„״£ˆ‚״§״× ״§„…״÷„‚״© ============
// GET /api/business/blocked-times
// GET /api/business/employees/:id/working-hours
export const getEmployeeWorkingHours = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, businessId: req.tenantId },
    select: { id: true },
  });
  if (!employee) throw ApiError.notFound("״§„…ˆ״¸ ״÷״± …ˆ״¬ˆ״¯");

  const hours = await prisma.workingHours.findMany({
    where: { businessId: req.tenantId, employeeId, serviceId: null },
    orderBy: { dayOfWeek: "asc" },
  });

  res.json({ success: true, workingHours: hours });
});

// PUT /api/business/employees/:id/working-hours
export const setEmployeeWorkingHours = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const { days } = req.body;
  if (!Array.isArray(days)) throw ApiError.badRequest("״µ״÷״© ״§„״£״§… ״÷״± ״µ״­״­״©");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, businessId: req.tenantId },
    select: { id: true, name: true },
  });
  if (!employee) throw ApiError.notFound("״§„…ˆ״¸ ״÷״± …ˆ״¬ˆ״¯");

  const businessHours = await prisma.workingHours.findMany({
    where: { businessId: req.tenantId, employeeId: null, serviceId: null, isClosed: false },
    select: { dayOfWeek: true },
  });
  const openDays = new Set(businessHours.map((h) => h.dayOfWeek));
  const allowedDays = days.filter((d) => openDays.has(Number(d.dayOfWeek)));

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { businessId: req.tenantId, employeeId, serviceId: null } });
    if (allowedDays.length) {
      await tx.workingHours.createMany({
        data: allowedDays.map((d) => ({
          businessId: req.tenantId,
          employeeId,
          serviceId: null,
          dayOfWeek: Number(d.dayOfWeek),
          startTime: d.startTime || "09:00",
          endTime: d.endTime || "17:00",
          breakStartTime: null,
          breakEndTime: null,
          isClosed: Boolean(d.isClosed),
        })),
      });
    }
  });

  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.WORKING_HOURS_CHANGED,
    entityType: "EmployeeWorkingHours",
    entityId: employeeId,
    meta: { employeeName: employee.name, days: allowedDays.length },
  });

  res.json({ success: true });
});

export const listBlockedTimes = asyncHandler(async (req, res) => {
  const blocked = await prisma.blockedTime.findMany({
    where: { businessId: req.tenantId },
    orderBy: { startAt: "desc" },
    include: { employee: { select: { name: true } } },
  });
  res.json({ success: true, blockedTimes: blocked });
});

// POST /api/business/blocked-times
export const createBlockedTime = asyncHandler(async (req, res) => {
  const { employeeId, startAt, endAt, reason } = req.body;
  if (!startAt || !endAt) throw ApiError.badRequest("ˆ‚״× ״§„״¨״¯״§״© ˆ״§„†‡״§״© …״·„ˆ״¨״§†");
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw ApiError.badRequest("Invalid blocked time range");
  if (end <= start) throw ApiError.badRequest("Blocked time end must be after start");

  if (employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: Number(employeeId), businessId: req.tenantId },
    });
    if (!emp) throw ApiError.notFound("״§„…ˆ״¸ ״÷״± …ˆ״¬ˆ״¯");
  }

  const blocked = await prisma.blockedTime.create({
    data: {
      businessId: req.tenantId,
      employeeId: employeeId ? Number(employeeId) : null,
      startAt: start,
      endAt: end,
      reason: reason || null,
    },
  });
  res.status(201).json({ success: true, blocked });
});

// DELETE /api/business/blocked-times/:id
export const deleteBlockedTime = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.blockedTime.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״÷״± …ˆ״¬ˆ״¯");
  await prisma.blockedTime.delete({ where: { id } });
  res.json({ success: true });
});

// ============ ״§„״­״¬ˆ״²״§״× ============
// GET /api/business/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=&status=
export const listAppointments = asyncHandler(async (req, res) => {
  const { from, to, employeeId, status, paymentStatus } = req.query;
  const where = { businessId: req.tenantId };

  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = new Date(`${from}T00:00:00`);
    if (to) where.startAt.lte = new Date(`${to}T23:59:59.999`);
  }
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      service: { select: { name: true, durationMinutes: true, price: true } },
      employee: { select: { name: true } },
      review: { select: { id: true, serviceRating: true, employeeRating: true, businessRating: true, createdAt: true } },
    },
  });
  res.json({ success: true, appointments });
});

// PATCH /api/business/appointments/:id ג€” ״×״¹״¯„ (״§„ˆ‚״×/״§„״­״§„״©/״§„…ˆ״¸)
export const updateAppointment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.appointment.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„״­״¬״² ״÷״± …ˆ״¬ˆ״¯");

  const ALLOWED_STATUS = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  const data = {};
  if (req.body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(req.body.status)) throw ApiError.badRequest("״­״§„״© ״÷״± ״µ״§„״­״©");
    data.status = req.body.status;
  }
  if (req.body.notes !== undefined) data.notes = req.body.notes;

  if (req.body.startAt !== undefined) {
    const start = new Date(req.body.startAt);
    if (isNaN(start.getTime())) throw ApiError.badRequest("ˆ‚״× ״÷״± ״µ״§„״­");
    const svc = await prisma.service.findUnique({ where: { id: existing.serviceId } });
    const end = new Date(start.getTime() + svc.durationMinutes * 60000);
    // ״¥״¹״§״¯״© ״§„״¬״¯ˆ„״© ״¬״¨ ״£† ״×״­״×״±… ״³״§״¹״§״× ״§„״¹…„ ˆ״¹״¯… ״§„״×״¯״§״®„ (…״¹ ״§״³״×״«†״§״¡ ״§„״­״¬״² †״³‡)
    await assertSlotAvailable(prisma, {
      businessId: req.tenantId,
      employeeId: existing.employeeId,
      serviceId: existing.serviceId,
      start,
      end,
      excludeId: id,
    });
    data.startAt = start;
    data.endAt = end;
  }

  let appointment = await prisma.appointment.update({ where: { id }, data });
  if (data.status === "COMPLETED") {
    const business = await prisma.business.findUnique({
      where: { id: req.tenantId },
      select: { reviewsEnabled: true },
    });
    if (business?.reviewsEnabled) {
      const reviewToken = await ensureAppointmentReviewToken(prisma, id);
      appointment = { ...appointment, reviewToken };
    }
  }
  if (data.status === "CONFIRMED" || data.status === "CANCELLED") {
    await prisma.notification.create({
      data: {
        businessId: req.tenantId,
        type: "CUSTOMER",
        message: data.status === "CONFIRMED"
          ? `تم قبول الدور للزبون ${existing.customerName} (${existing.customerPhone})`
          : `تم رفض الدور للزبون ${existing.customerName} (${existing.customerPhone})`,
      },
    });
  }
  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.BOOKING_UPDATED,
    entityType: "Appointment",
    entityId: id,
    meta: { changes: Object.keys(data) },
  });
  res.json({ success: true, appointment });
});

// POST /api/business/appointments/:id/review-link
export const createAppointmentReviewLink = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: {
      business: { select: { id: true, name: true, reviewsEnabled: true } },
      review: { select: { id: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("الحجز غير موجود");
  if (!appointment.business.reviewsEnabled) throw ApiError.badRequest("نظام التقييمات غير مفعّل لهذا المحل");
  if (appointment.status !== "COMPLETED") throw ApiError.badRequest("يمكن إرسال رابط التقييم بعد اكتمال الحجز فقط");
  if (appointment.review) throw ApiError.badRequest("تم تقييم هذا الحجز مسبقًا");

  const reviewToken = await ensureAppointmentReviewToken(prisma, appointment.id);
  const reviewUrl = `${publicAppUrl(req)}/review/${reviewToken}`;
  const sendResult = await sendAppointmentReviewLink(prisma, appointment.id, req);
  res.json({ success: true, token: reviewToken, path: `/review/${reviewToken}`, url: reviewUrl, whatsapp: sendResult.whatsapp });
});

// PATCH /api/business/appointments/:id/delay
export const delayAppointment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const delayMinutes = Number(req.body.delayMinutes);
  if (!Number.isInteger(delayMinutes) || delayMinutes <= 0) {
    throw ApiError.badRequest("Delay minutes must be a positive number");
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: { service: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound("Appointment not found");

  const blockingStatuses = ["PENDING", "CONFIRMED"];
  const shifted = await prisma.$transaction(async (tx) => {
    const appointments = await tx.appointment.findMany({
      where: {
        businessId: req.tenantId,
        employeeId: existing.employeeId,
        startAt: { gte: existing.startAt },
        status: { in: blockingStatuses },
      },
      orderBy: { startAt: "desc" },
      include: { service: { select: { name: true } } },
    });

    const updated = [];
    for (const appointment of appointments) {
      const startAt = new Date(appointment.startAt.getTime() + delayMinutes * 60000);
      const endAt = new Date(appointment.endAt.getTime() + delayMinutes * 60000);
      updated.push(await tx.appointment.update({
        where: { id: appointment.id },
        data: { startAt, endAt },
        include: { service: { select: { name: true } } },
      }));
    }

    await tx.notification.createMany({
      data: updated.map((appointment) => ({
        businessId: req.tenantId,
        type: "CUSTOMER",
        message: `تم تأخير دور ${appointment.customerName} (${appointment.customerPhone}) ${delayMinutes} دقيقة. الوقت الجديد: ${appointment.startAt.toLocaleString("ar")}. مناسب: /appointment-response/${appointment.id}/accepted | غير مناسب: /appointment-response/${appointment.id}/rejected`,
      })),
    });

    return updated.reverse();
  });

  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.BOOKING_UPDATED,
    entityType: "Appointment",
    entityId: id,
    meta: { delayMinutes, shiftedAppointments: shifted.length },
  });

  res.json({ success: true, appointments: shifted });
});

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/business/appointments/:id/requeue-options?date=
export const getAppointmentRequeueOptions = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true } },
      employee: { select: { id: true, name: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("الموعد غير موجود");

  const date = req.query.date || todayInput();
  const [originalSlots, allSlots] = await Promise.all([
    getAvailability({
      businessId: req.tenantId,
      serviceId: appointment.serviceId,
      employeeId: appointment.employeeId,
      date,
    }),
    getAvailability({
      businessId: req.tenantId,
      serviceId: appointment.serviceId,
      date,
    }),
  ]);

  const alternatives = allSlots.filter((slot) => slot.employeeId !== appointment.employeeId);
  res.json({
    success: true,
    appointment,
    originalEmployee: appointment.employee,
    originalSlots: originalSlots.slice(0, 8),
    alternativeSlots: alternatives.slice(0, 12),
  });
});

// PATCH /api/business/appointments/:id/requeue
export const requeueAppointment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const employeeId = Number(req.body.employeeId);
  const start = new Date(req.body.startAt);
  if (!employeeId || Number.isNaN(start.getTime())) {
    throw ApiError.badRequest("اختر العامل والوقت");
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: { service: { select: { durationMinutes: true } } },
  });
  if (!appointment) throw ApiError.notFound("الموعد غير موجود");

  const end = new Date(start.getTime() + appointment.service.durationMinutes * 60000);
  await assertSlotAvailable(prisma, {
    businessId: req.tenantId,
    employeeId,
    serviceId: appointment.serviceId,
    start,
    end,
    excludeId: appointment.id,
  });

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      employeeId,
      startAt: start,
      endAt: end,
      status: "CONFIRMED",
      notes: `${appointment.notes || ""}\nإعادة للدور عبر إدارة الحجوزات`.trim(),
    },
    include: {
      service: { select: { name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.BOOKING_UPDATED,
    entityType: "Appointment",
    entityId: id,
    meta: { requeued: true, employeeId, startAt: start },
  });

  res.json({ success: true, appointment: updated });
});

// DELETE /api/business/appointments/:id ג€” ״¥„״÷״§״¡
export const cancelAppointment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.appointment.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„״­״¬״² ״÷״± …ˆ״¬ˆ״¯");
  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.BOOKING_CANCELLED,
    entityType: "Appointment",
    entityId: id,
    meta: { customerName: existing.customerName },
  });
  res.json({ success: true, appointment });
});

// PATCH /api/business/appointments/:id/payment ג€” ״×״÷״± ״­״§„״© ״§„״¯״¹ ״¯ˆ‹״§
// …״³…ˆ״­ „״µ״§״­״¨ ״§„…״­„ ‚״· „״­״¬ˆ״²״§״× "״§„״¯״¹  ״§„…״­„". ״§„״¯״¹ ״§„״¥„ƒ״×״±ˆ† „״§ ״¹״¯‘„ ״¥„״§ …† SUPER_ADMIN.
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
export const updateAppointmentPayment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { paymentStatus } = req.body;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    throw ApiError.badRequest("״­״§„״© ״¯״¹ ״÷״± ״µ״§„״­״©");
  }

  const existing = await prisma.appointment.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„״­״¬״² ״÷״± …ˆ״¬ˆ״¯");
  if (existing.paymentStatus === "PAID" && paymentStatus !== "PAID") {
    throw ApiError.badRequest("Paid appointments cannot have their payment status changed");
  }

  if (existing.paymentMethod !== "PAY_AT_STORE") {
    throw ApiError.forbidden("„״§ …ƒ† ״×״¹״¯„ ״­״§„״© ״§„״¯״¹ ״§„״¥„ƒ״×״±ˆ† ״¯ˆ‹״§ (״×״·„‘״¨ ״µ„״§״­״© ״§„״¥״¯״§״±״©)");
  }

  const serviceForPayment = paymentStatus === "PAID" && existing.paymentAmount == null
    ? await prisma.service.findUnique({ where: { id: existing.serviceId }, select: { price: true } })
    : null;
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
      ...(serviceForPayment ? { paymentAmount: serviceForPayment.price } : {}),
      ...(paymentStatus === "PAID" ? { status: "COMPLETED" } : {}),
    },
  });
  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.PAYMENT_STATUS_CHANGED,
    entityType: "Appointment",
    entityId: id,
    meta: { paymentStatus, by: "owner" },
  });
  if (appointment.paymentStatus === "PAID") {
    await recordCustomerPayment(prisma, appointment);
    await sendAppointmentReviewLink(prisma, appointment.id, req).catch(() => null);
  }
  res.json({ success: true, appointment });
});

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function ticketBusiness(business) {
  return {
    name: business.name,
    logoUrl: business.logoUrl,
    brandColor: business.brandColor,
  };
}

function dailyAppointmentNumber(appointments, appointmentId) {
  const index = appointments.findIndex((item) => item.id === appointmentId);
  return index >= 0 ? index + 1 : appointments.length + 1;
}

async function buildQueueTicket({ businessId, appointment, business, ticketType = "SCHEDULED", note = null }) {
  const { start, end } = dayBounds(appointment.startAt.toISOString().slice(0, 10));
  const confirmedAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: "CONFIRMED",
      startAt: { gte: start, lt: end },
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });
  const index = confirmedAppointments.findIndex((item) => item.id === appointment.id);
  const bookingNumber = dailyAppointmentNumber(confirmedAppointments, appointment.id);
  return {
    queueNumber: index >= 0 ? index + 1 : confirmedAppointments.length + 1,
    peopleAhead: Math.max(0, index),
    bookingNumber,
    appointmentId: appointment.id,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    service: appointment.service?.name,
    employee: appointment.employee?.name,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    ticketType,
    note,
    queueRule: "حسب وقت الموعد في جدول اليوم",
    business: ticketBusiness(business),
  };
}

// POST /api/business/secretary/session
export const openSecretarySession = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const cleanPin = String(pin || "").trim();
  if (!cleanPin) throw ApiError.badRequest("أدخل الرقم السري");

  const business = await prisma.business.findUnique({ where: { id: req.tenantId } });
  if (!business?.printScreenEnabled) throw ApiError.forbidden("صفحة السكرتيرة متاحة فقط عند تفعيل شاشة طباعة الأدوار");

  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, role: true, passwordHash: true },
  });
  if (currentUser && await comparePassword(cleanPin, currentUser.passwordHash)) {
    return res.json({
      success: true,
      actor: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
    });
  }

  const employees = await prisma.employee.findMany({
    where: {
      businessId: req.tenantId,
      isActive: true,
      role: "SECRETARY",
      loginPassword: { not: null },
    },
    select: { id: true, name: true, role: true, loginPassword: true },
  });
  const secretary = employees.find((employee) => employee.loginPassword === cleanPin);
  if (!secretary) throw ApiError.unauthorized("الرقم السري غير صحيح أو الموظف ليس بدور سكرتير/ة");

  res.json({
    success: true,
    actor: { id: secretary.id, name: secretary.name, role: "SECRETARY" },
  });
});

// GET /api/business/secretary/today?employeeId=
export const secretaryToday = asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.tenantId } });
  if (!business?.printScreenEnabled) throw ApiError.forbidden("صفحة السكرتيرة متاحة فقط عند تفعيل شاشة طباعة الأدوار");

  const date = req.query.date || todayDateInput();
  const { start, end } = dayBounds(date);
  const where = {
    businessId: req.tenantId,
    startAt: { gte: start, lt: end },
  };
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    include: {
      service: { select: { name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true } },
    },
  });
  const employees = await prisma.employee.findMany({
    where: { businessId: req.tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });

  res.json({ success: true, business, employees, appointments });
});

// POST /api/business/secretary/late-ticket
export const secretaryLateTicket = asyncHandler(async (req, res) => {
  const appointmentId = Number(req.body.appointmentId);
  const business = await prisma.business.findUnique({ where: { id: req.tenantId } });
  if (!business?.printScreenEnabled) throw ApiError.forbidden("صفحة السكرتيرة متاحة فقط عند تفعيل شاشة طباعة الأدوار");
  if (!appointmentId) throw ApiError.badRequest("اختر الحجز أولًا");

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: req.tenantId },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true } },
      employee: { select: { id: true, name: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("الحجز غير موجود");
  if (appointment.status !== "CONFIRMED") throw ApiError.badRequest("لا يمكن إصدار ورقة دخول إلا لحجز مؤكد");

  const now = new Date();
  if (now <= appointment.endAt) {
    throw ApiError.badRequest("هذا الحجز لم ينته وقته بعد، استخدم ورقة الدور العادية");
  }
  const start = new Date(now.getTime() + 60 * 1000);
  const end = new Date(start.getTime() + appointment.service.durationMinutes * 60000);

  await assertSlotAvailable(prisma, {
    businessId: req.tenantId,
    employeeId: appointment.employeeId,
    serviceId: appointment.serviceId,
    start,
    end,
    excludeId: appointment.id,
  });

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startAt: start,
      endAt: end,
      notes: `${appointment.notes || ""}\nإدخال متأخر عبر السكرتيرة`.trim(),
    },
    include: {
      service: { select: { name: true, durationMinutes: true } },
      employee: { select: { name: true } },
    },
  });

  const ticket = await buildQueueTicket({
    businessId: req.tenantId,
    appointment: updated,
    business,
    ticketType: "LATE_ENTRY",
    note: "ورقة دخول متأخر - تم فحص توفر العامل الآن",
  });

  await logAudit({
    businessId: req.tenantId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.BOOKING_UPDATED,
    entityType: "Appointment",
    entityId: appointment.id,
    meta: { secretaryLateEntry: true },
  });

  res.json({ success: true, ticket, appointment: updated });
});

// GET /api/business/audit-logs ג€” ״³״¬„‘ †״´״§״· ״§„…״­„ (״¢״®״± 100 ״­״¯״«)
export const listAuditLogs = asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { businessId: req.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ success: true, logs });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { businessId: req.tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json({ success: true, notifications });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { businessId: req.tenantId, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
});

export const deleteNotifications = asyncHandler(async (req, res) => {
  await prisma.notification.deleteMany({
    where: { businessId: req.tenantId },
  });
  res.json({ success: true });
});



