import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

// الموظف يرى مواعيده فقط: نربط حساب المستخدم (req.user) بسجل الموظف عبر userId.
async function getEmployeeForUser(userId, businessId) {
  const emp = await prisma.employee.findFirst({ where: { userId, businessId } });
  if (!emp) throw ApiError.forbidden("لا يوجد ملف موظف مرتبط بحسابك");
  return emp;
}

// GET /api/staff/appointments?from=&to=
export const myAppointments = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  const { from, to } = req.query;

  const where = { businessId: req.tenantId, employeeId: emp.id };
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = new Date(`${from}T00:00:00`);
    if (to) where.startAt.lte = new Date(`${to}T23:59:59.999`);
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: { service: { select: { name: true, durationMinutes: true, price: true } } },
  });
  res.json({ success: true, employee: { id: emp.id, name: emp.name }, appointments });
});

// PATCH /api/staff/appointments/:id/status — تحديث حالة موعده فقط
export const updateMyAppointmentStatus = asyncHandler(async (req, res) => {
  const emp = await getEmployeeForUser(req.user.id, req.tenantId);
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  if (!allowed.includes(status)) throw ApiError.badRequest("حالة غير صالحة");

  // العزل المزدوج: الموعد يجب أن يخص محلّه و موظفه هو نفسه
  const appt = await prisma.appointment.findFirst({
    where: { id, businessId: req.tenantId, employeeId: emp.id },
  });
  if (!appt) throw ApiError.notFound("الموعد غير موجود ضمن مواعيدك");

  const appointment = await prisma.appointment.update({ where: { id }, data: { status } });
  res.json({ success: true, appointment });
});
