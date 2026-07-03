import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { recordCustomerBooking } from "./customer.service.js";
import {
  hhmmToMinutes,
  minutesToHHMM,
  dateAtMinutes,
  dayOfWeek,
  overlaps,
  dayBounds,
} from "../utils/time.js";

// الحجوزات التي "تشغل" الوقت فعليًا (الملغاة لا تحجب الوقت)
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"];

async function getServiceHours(client, businessId, serviceId, dayOfWeek) {
  return client.workingHours.findFirst({
    where: { businessId, serviceId: Number(serviceId), employeeId: null, dayOfWeek },
  });
}

function addDays(dateStr, offset) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function overlapsBreak(startMin, endMin, hours) {
  if (!hours.breakStartTime || !hours.breakEndTime) return false;
  const breakStart = hhmmToMinutes(hours.breakStartTime);
  const breakEnd = hhmmToMinutes(hours.breakEndTime);
  if (breakEnd <= breakStart) return false;
  return startMin < breakEnd && endMin > breakStart;
}

function withFallbackBreak(hours, ...fallbacks) {
  if (!hours) return hours;
  const breakSource = [hours, ...fallbacks].find((item) => item?.breakStartTime && item?.breakEndTime);
  return {
    ...hours,
    breakStartTime: breakSource?.breakStartTime || null,
    breakEndTime: breakSource?.breakEndTime || null,
  };
}

async function isBusinessFullyBlocked(client, businessId, date) {
  const { start, end } = dayBounds(date);
  const blocked = await client.blockedTime.findFirst({
    where: {
      businessId,
      employeeId: null,
      startAt: { lte: start },
      endAt: { gte: end },
    },
    select: { id: true },
  });
  return Boolean(blocked);
}

export async function getBusinessClosureInfo({ businessId, date, lookaheadDays = 30 }) {
  if (!date) throw ApiError.badRequest("التاريخ مطلوب (date=YYYY-MM-DD)");

  const checkDate = async (dateStr) => {
    const hours = await prisma.workingHours.findFirst({
      where: { businessId, employeeId: null, serviceId: null, dayOfWeek: dayOfWeek(dateStr) },
    });
    const fullyBlocked = await isBusinessFullyBlocked(prisma, businessId, dateStr);
    return Boolean(hours && !hours.isClosed && !fullyBlocked);
  };

  if (await checkDate(date)) return null;

  let nextOpenDate = null;
  for (let i = 1; i <= lookaheadDays; i += 1) {
    const candidate = addDays(date, i);
    if (await checkDate(candidate)) {
      nextOpenDate = candidate;
      break;
    }
  }

  return {
    isClosed: true,
    message: "المحل مغلق اليوم نستميحكم عذرا",
    nextOpenDate,
  };
}

/**
 * يحسب الفتحات المتاحة لخدمة في يوم معيّن.
 *
 * الخوارزمية:
 *  1) جلب الخدمة لمعرفة مدتها (durationMinutes).
 *  2) تحديد الموظفين المرشحين (موظف محدد أو كل من يقدّم الخدمة).
 *  3) لكل موظف: إيجاد دوام ذلك اليوم (دوام الموظف إن وُجد وإلا دوام المحل).
 *  4) توليد فتحات متتالية بطول مدة الخدمة داخل نافذة الدوام.
 *  5) استبعاد ما يتداخل مع: الحجوزات الحالية + الأوقات المغلقة + الماضي.
 *
 * @returns {Promise<Array<{time, startAt, endAt, employeeId, employeeName}>>}
 */
export async function getAvailability({ businessId, serviceId, employeeId, date }) {
  if (!date) throw ApiError.badRequest("التاريخ مطلوب (date=YYYY-MM-DD)");

  const service = await prisma.service.findFirst({
    where: { id: Number(serviceId), businessId, isActive: true },
  });
  if (!service) throw ApiError.notFound("الخدمة غير موجودة");

  const duration = service.durationMinutes;
  const dow = dayOfWeek(date);
  const { start: dayStart, end: dayEnd } = dayBounds(date);
  const closure = await getBusinessClosureInfo({ businessId, date });
  if (closure) return [];

  // (2) الموظفون المرشّحون
  let employees;
  if (employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: Number(employeeId), businessId, isActive: true },
    });
    if (!emp) throw ApiError.notFound("الموظف غير موجود");
    employees = [emp];
  } else {
    // كل موظف نشِط يقدّم هذه الخدمة
    employees = await prisma.employee.findMany({
      where: {
        businessId,
        isActive: true,
        services: { some: { serviceId: service.id } },
      },
    });
  }
  if (employees.length === 0) return [];

  // الدوام العام للمحل لهذا اليوم (يُستخدم كافتراضي إن لم يكن للموظف دوام خاص)
  const businessHours = await prisma.workingHours.findFirst({
    where: { businessId, employeeId: null, serviceId: null, dayOfWeek: dow },
  });

  const serviceHours = await getServiceHours(prisma, businessId, service.id, dow);

  // كل الحجوزات والأوقات المغلقة لهذا اليوم دفعة واحدة (أداء أفضل)
  const [appointments, blocked] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        startAt: { gte: dayStart, lte: dayEnd },
        status: { in: BLOCKING_STATUSES },
      },
      select: { employeeId: true, startAt: true, endAt: true },
    }),
    prisma.blockedTime.findMany({
      where: {
        businessId,
        startAt: { lte: dayEnd },
        endAt: { gte: dayStart },
      },
      select: { employeeId: true, startAt: true, endAt: true },
    }),
  ]);

  const now = new Date();
  const slotsByTime = new Map(); // time -> أول موظف متاح

  for (const emp of employees) {
    // (3) دوام الموظف لهذا اليوم، وإلا دوام المحل
    const empHours = await prisma.workingHours.findFirst({
      where: { businessId, employeeId: emp.id, serviceId: null, dayOfWeek: dow },
    });
    const hours = withFallbackBreak(serviceHours || empHours || businessHours, empHours, businessHours);
    if (!hours || hours.isClosed) continue; // يوم إجازة

    const winStart = hhmmToMinutes(hours.startTime);
    const winEnd = hhmmToMinutes(hours.endTime);

    // (4) توليد فتحات متتالية بطول الخدمة
    for (let s = winStart; s + duration <= winEnd; s += duration) {
      if (overlapsBreak(s, s + duration, hours)) continue;
      const slotStart = dateAtMinutes(date, s);
      const slotEnd = dateAtMinutes(date, s + duration);

      // استبعاد الماضي
      if (slotStart <= now) continue;

      // (5a) تداخل مع حجوزات هذا الموظف
      const clashAppt = appointments.some(
        (a) =>
          a.employeeId === emp.id &&
          overlaps(slotStart, slotEnd, a.startAt, a.endAt)
      );
      if (clashAppt) continue;

      // (5b) تداخل مع وقت مغلق (يخص الموظف أو المحل كله)
      const clashBlocked = blocked.some(
        (b) =>
          (b.employeeId === null || b.employeeId === emp.id) &&
          overlaps(slotStart, slotEnd, b.startAt, b.endAt)
      );
      if (clashBlocked) continue;

      const time = minutesToHHMM(s);
      if (!slotsByTime.has(time)) {
        slotsByTime.set(time, {
          time,
          startAt: slotStart,
          endAt: slotEnd,
          employeeId: emp.id,
          employeeName: emp.name,
        });
      }
    }
  }

  // ترتيب حسب الوقت
  return [...slotsByTime.values()].sort((a, b) => a.startAt - b.startAt);
}

/**
 * ينشئ حجزًا بأمان ضد التكرار/التداخل عبر transaction.
 * يعيد التحقق من التوفّر داخل المعاملة لمنع race conditions.
 */
export async function createAppointmentSafe({
  businessId,
  serviceId,
  employeeId,
  customerName,
  customerPhone,
  customerEmail,
  startAt,
  notes,
  paymentMethod, // "ONLINE" | "PAY_AT_STORE"
  paymentReference, // مطلوب فقط لـ ONLINE
  requiresApproval = true,
}) {
  const service = await prisma.service.findFirst({
    where: { id: Number(serviceId), businessId, isActive: true },
  });
  if (!service) throw ApiError.notFound("الخدمة غير موجودة");

  const start = new Date(startAt);
  if (isNaN(start.getTime())) throw ApiError.badRequest("وقت غير صالح");
  if (start <= new Date()) throw ApiError.badRequest("لا يمكن الحجز في وقت ماضٍ");

  const end = new Date(start.getTime() + service.durationMinutes * 60000);

  return prisma.$transaction(async (tx) => {
    const emp = await tx.employee.findFirst({
      where: { id: Number(employeeId), businessId, isActive: true },
    });
    if (!emp) throw ApiError.notFound("الموظف غير موجود");

    // التحقق الشامل: ساعات العمل + التداخل + الأوقات المغلقة (داخل المعاملة)
    await assertSlotAvailable(tx, { businessId, employeeId: emp.id, serviceId: service.id, start, end });

    // الدفع في المحل => يُؤكَّد الموعد مباشرة. الدفع الإلكتروني => يبقى PENDING حتى نجاح الدفع.
    const initialStatus = requiresApproval ? "PENDING" : "CONFIRMED";

    const appointment = await tx.appointment.create({
      data: {
        businessId,
        serviceId: service.id,
        employeeId: emp.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        startAt: start,
        endAt: end,
        status: initialStatus,
        notes: notes || null,
        paymentMethod: paymentMethod || null,
        paymentStatus: "PENDING",
        paymentAmount: service.price,
        paymentReference: paymentMethod === "ONLINE" ? paymentReference : null,
      },
      include: { service: true, employee: true },
    });

    await recordCustomerBooking(tx, appointment);

    // إشعار لصاحب المحل
    await tx.notification.create({
      data: {
        businessId,
        type: "NEW_APPOINTMENT",
        message: `حجز جديد: ${customerName} - ${service.name}`,
      },
    });

    return appointment;
  });
}

/**
 * تحقق شامل من إمكانية حجز فتحة: ساعات العمل + عدم التداخل + الأوقات المغلقة.
 * يُستخدم عند إنشاء الحجز وعند إعادة الجدولة. يقبل عميل Prisma أو transaction client.
 * @param {*} client prisma أو tx
 * @param {{businessId:number, employeeId:number, start:Date, end:Date, excludeId?:number}} opts
 */
export async function assertSlotAvailable(client, { businessId, employeeId, serviceId = null, start, end, excludeId = null }) {
  // 1) ساعات العمل (دوام الموظف إن وُجد، وإلا دوام المحل العام)
  const dow = start.getDay();
  const dateStr = formatDate(start);
  const businessWh = await client.workingHours.findFirst({ where: { businessId, employeeId: null, serviceId: null, dayOfWeek: dow } });
  const fullyBlocked = await isBusinessFullyBlocked(client, businessId, dateStr);
  if (!businessWh || businessWh.isClosed || fullyBlocked) {
    throw ApiError.badRequest("المحل مغلق اليوم نستميحكم عذرا");
  }
  const serviceHours = serviceId ? await getServiceHours(client, businessId, serviceId, dow) : null;
  const employeeWh = await client.workingHours.findFirst({ where: { businessId, employeeId, serviceId: null, dayOfWeek: dow } });
  const wh = withFallbackBreak(serviceHours || employeeWh || businessWh, employeeWh, businessWh);
  if (!wh || wh.isClosed) {
    throw ApiError.badRequest("Business is closed at this time");
  }
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  if (startMin < hhmmToMinutes(wh.startTime) || endMin > hhmmToMinutes(wh.endTime)) {
    throw ApiError.badRequest("الوقت المختار خارج ساعات عمل المحل");
  }

  // 2) التداخل مع حجوزات الموظف (مع استثناء الحجز نفسه عند إعادة الجدولة)
  if (overlapsBreak(startMin, endMin, wh)) {
    throw ApiError.badRequest("هذا الوقت ضمن وقت الاستراحة وغير متاح للحجز");
  }

  const clash = await client.appointment.findFirst({
    where: {
      employeeId,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (clash) {
    throw ApiError.conflict("هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر");
  }

  // 3) الأوقات المغلقة (تخص الموظف أو المحل كله)
  const blocked = await client.blockedTime.findFirst({
    where: {
      businessId,
      OR: [{ employeeId: null }, { employeeId }],
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });
  if (blocked) {
    throw ApiError.conflict("هذا الوقت مغلق وغير متاح للحجز");
  }
}
