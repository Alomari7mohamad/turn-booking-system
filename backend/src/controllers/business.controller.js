import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.js";
import { dayBounds } from "../utils/time.js";
import { assertSlotAvailable } from "../services/availability.service.js";
import { logAudit, AUDIT } from "../services/audit.service.js";

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

  const data = {};
  const businessInfoKeys = ["name", "email", "phone", "address", "logoUrl", "brandColor", "timezone"];
  businessInfoKeys.forEach((k) => {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  });

  const paymentKeys = ["onlinePaymentEnabled", "payAtStoreEnabled"];
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
  const { name, phone, title, serviceIds = [], loginEmail, loginPassword } = req.body;
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
      data: { businessId: req.tenantId, name, phone, title, userId, loginPassword: loginPassword || null },
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

  const { name, phone, title, isActive, serviceIds, loginEmail, loginPassword } = req.body;

  await prisma.$transaction(async (tx) => {
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (title !== undefined) data.title = title;
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
  const { name, description, durationMinutes, price, serviceHours = [] } = req.body;
  if (!name || !durationMinutes) throw ApiError.badRequest("Service name and duration are required");
  const service = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        businessId: req.tenantId,
        name,
        description: description || null,
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

  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.description !== undefined) data.description = req.body.description;
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
    await tx.workingHours.createMany({
      data: days.map((d) => ({
        businessId: req.tenantId,
        employeeId: null,
        serviceId: null,
        dayOfWeek: Number(d.dayOfWeek),
        startTime: d.startTime || "09:00",
        endTime: d.endTime || "17:00",
        breakStartTime: d.breakStartTime || null,
        breakEndTime: d.breakEndTime || null,
        isClosed: Boolean(d.isClosed),
      })),
    });
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

  const appointment = await prisma.appointment.update({ where: { id }, data });
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

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
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
  res.json({ success: true, appointment });
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



