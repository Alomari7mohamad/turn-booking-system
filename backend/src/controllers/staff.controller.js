import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { assertSlotAvailable, getAvailability } from "../services/availability.service.js";
import { ensureAppointmentReviewToken, sendAppointmentReviewLink } from "../services/review.service.js";
import { recordCustomerPayment } from "../services/customer.service.js";

// ״§„…ˆ״¸ ״±‰ …ˆ״§״¹״¯‡ ‚״·: †״±״¨״· ״­״³״§״¨ ״§„…״³״×״®״¯… (req.user) ״¨״³״¬„ ״§„…ˆ״¸ ״¹״¨״± userId.
async function getEmployeeForUser(userId, businessId) {
  const emp = await prisma.employee.findFirst({ where: { userId, businessId } });
  if (!emp) throw ApiError.forbidden("„״§ ˆ״¬״¯ …„ …ˆ״¸ …״±״×״¨״· ״¨״­״³״§״¨ƒ");
  return emp;
}

// GET /api/staff/appointments?from=&to=
export const myAppointments = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  const { from, to, employeeId, includePending } = req.query;

  const where = { businessId: req.tenantId, status: { not: "ARCHIVED" } };
  if (emp.role !== "SECRETARY") where.employeeId = emp.id;
  if (emp.role === "SECRETARY" && employeeId) where.employeeId = Number(employeeId);
  if (from || to) {
    const startAt = {};
    if (from) startAt.gte = new Date(`${from}T00:00:00`);
    if (to) startAt.lte = new Date(`${to}T23:59:59.999`);
    if (emp.role === "SECRETARY" && includePending === "true") {
      where.OR = [{ startAt }, { status: "PENDING" }];
    } else {
      where.startAt = startAt;
    }
  }
  if (req.query.status) where.status = req.query.status;

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      service: { select: { name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true } },
      review: { select: { id: true, serviceRating: true, employeeRating: true, businessRating: true, createdAt: true } },
    },
  });
  res.json({ success: true, employee: { id: emp.id, name: emp.name, role: emp.role }, appointments });
});

export const listStaffEmployees = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  if (emp.role !== "SECRETARY") {
    return res.json({ success: true, employees: [{ id: emp.id, name: emp.name, role: emp.role }] });
  }
  const employees = await prisma.employee.findMany({
    where: { businessId: req.tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, title: true },
  });
  res.json({ success: true, employees });
});

// PATCH /api/staff/appointments/:id/status ג€” ״×״­״¯״« ״­״§„״© …ˆ״¹״¯‡ ‚״·
export const updateMyAppointmentStatus = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = emp.role === "SECRETARY"
    ? ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]
    : ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  if (!allowed.includes(status)) throw ApiError.badRequest("״­״§„״© ״÷״± ״µ״§„״­״©");

  // ״§„״¹״²„ ״§„…״²״¯ˆ״¬: ״§„…ˆ״¹״¯ ״¬״¨ ״£† ״®״µ …״­„‘‡ ˆ …ˆ״¸‡ ‡ˆ †״³‡
  const appt = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId, ...(emp.role === "SECRETARY" ? {} : { employeeId: emp.id }) },
  });
  if (!appt) throw ApiError.notFound("״§„…ˆ״¹״¯ ״÷״± …ˆ״¬ˆ״¯ ״¶…† …ˆ״§״¹״¯ƒ");

  const serviceForConfirmation = status === "CONFIRMED" && appt.paymentAmount == null
    ? await prisma.service.findUnique({ where: { id: appt.serviceId }, select: { price: true } })
    : null;
  let appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      ...(serviceForConfirmation ? { paymentAmount: serviceForConfirmation.price, paymentStatus: "PENDING" } : {}),
    },
  });
  if (status === "COMPLETED") {
    const business = await prisma.business.findUnique({
      where: { id: req.tenantId },
      select: { reviewsEnabled: true },
    });
    if (business?.reviewsEnabled) {
      const reviewToken = await ensureAppointmentReviewToken(prisma, id);
      appointment = { ...appointment, reviewToken };
    }
  }
  res.json({ success: true, appointment });
});

export const createStaffAppointmentReviewLink = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  const id = Number(req.params.id);
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId, ...(emp.role === "SECRETARY" ? {} : { employeeId: emp.id }) },
    include: {
      business: { select: { reviewsEnabled: true } },
      review: { select: { id: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("״§„״­״¬״² ״÷״± …ˆ״¬ˆ״¯");
  if (!appointment.business.reviewsEnabled) throw ApiError.badRequest("†״¸״§… ״§„״×‚…״§״× ״÷״± …״¹‘„ „‡״°״§ ״§„…״­„");
  if (appointment.status !== "COMPLETED" && new Date(appointment.endAt) > new Date()) {     throw ApiError.badRequest("يمكن إرسال رابط التقييم بعد انتهاء وقت الحجز");   }
  if (appointment.review) throw ApiError.badRequest("״×… ״×‚… ‡״°״§ ״§„״­״¬״² …״³״¨‚‹״§");
  const reviewToken = await ensureAppointmentReviewToken(prisma, appointment.id);
  res.json({ success: true, token: reviewToken, path: `/review/${reviewToken}` });
});

export const updateStaffAppointmentPayment = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  if (emp.role !== "SECRETARY") throw ApiError.forbidden("‡״°‡ ״§„״¹…„״© …״×״§״­״© „„״³ƒ״±״×״±/״© ‚״·");

  const id = Number(req.params.id);
  const { paymentStatus } = req.body;
  if (!["PENDING", "PAID", "FAILED", "REFUNDED"].includes(paymentStatus)) {
    throw ApiError.badRequest("״­״§„״© ״¯״¹ ״÷״± ״µ״§„״­״©");
  }

  const existing = await prisma.appointment.findFirst({ where: { id, businessId: req.tenantId } });
  if (!existing) throw ApiError.notFound("״§„…ˆ״¹״¯ ״÷״± …ˆ״¬ˆ״¯");
  if (existing.paymentStatus === "PAID" && paymentStatus !== "PAID") {
    throw ApiError.badRequest("„״§ …ƒ† ״×״÷״± ״­״§„״© …ˆ״¹״¯ …״¯ˆ״¹");
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
  if (appointment.paymentStatus === "PAID") {
    await recordCustomerPayment(prisma, appointment);
    await sendAppointmentReviewLink(prisma, appointment.id, req).catch(() => null);
  }
  res.json({ success: true, appointment });
});

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export const getRequeueOptions = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  if (emp.role !== "SECRETARY") throw ApiError.forbidden("‡״°‡ ״§„״¹…„״© …״×״§״­״© „„״³ƒ״±״×״±/״© ‚״·");

  const id = Number(req.params.id);
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true } },
      employee: { select: { id: true, name: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("״§„…ˆ״¹״¯ ״÷״± …ˆ״¬ˆ״¯");

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

export const requeueAppointment = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  if (emp.role !== "SECRETARY") throw ApiError.forbidden("‡״°‡ ״§„״¹…„״© …״×״§״­״© „„״³ƒ״±״×״±/״© ‚״·");

  const id = Number(req.params.id);
  const employeeId = Number(req.body.employeeId);
  const start = new Date(req.body.startAt);
  if (!employeeId || Number.isNaN(start.getTime())) {
    throw ApiError.badRequest("״§״®״×״± ״§„״¹״§…„ ˆ״§„ˆ‚״×");
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId },
    include: { service: { select: { durationMinutes: true } } },
  });
  if (!appointment) throw ApiError.notFound("״§„…ˆ״¹״¯ ״÷״± …ˆ״¬ˆ״¯");

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
      notes: `${appointment.notes || ""}\n״¥״¹״§״¯״© „„״¯ˆ״± ״¹״¨״± ‚״³… ״§„״³ƒ״±״×״§״±״©`.trim(),
    },
    include: {
      service: { select: { name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true } },
    },
  });

  res.json({ success: true, appointment: updated });
});
