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
import {
  buildFreeIntervals,
  generateDynamicCandidates,
} from "./intervalScheduling.service.js";

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

function intervalFromDates(startAt, endAt, source, dayStart, dayEnd) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return {
    start_time: start <= dayStart ? 0 : start.getHours() * 60 + start.getMinutes(),
    end_time: end >= dayEnd ? 24 * 60 : end.getHours() * 60 + end.getMinutes(),
    source,
  };
}

function effectiveWorkingWindow(hoursRecords) {
  const applicable = hoursRecords.filter(Boolean);
  if (!applicable.length || applicable.some((hours) => hours.isClosed)) return null;
  const start_time = Math.max(...applicable.map((hours) => hhmmToMinutes(hours.startTime)));
  const end_time = Math.min(...applicable.map((hours) => hhmmToMinutes(hours.endTime)));
  return end_time > start_time ? { start_time, end_time } : null;
}

function breakIntervals(hoursRecords) {
  return hoursRecords.filter(Boolean).flatMap((hours) => {
    if (!hours.breakStartTime || !hours.breakEndTime) return [];
    const start_time = hhmmToMinutes(hours.breakStartTime);
    const end_time = hhmmToMinutes(hours.breakEndTime);
    return end_time > start_time ? [{ start_time, end_time, source: "break" }] : [];
  });
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

/** يحسب الأوقات المتاحة من الفجوات الحرة الفعلية لكل موظف. */
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

  // كل الحجوزات والإغلاقات وأقصر خدمة تُجلب دفعة واحدة.
  const [appointments, blocked, shortestService] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
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
    prisma.service.aggregate({
      where: { businessId, isActive: true },
      _min: { durationMinutes: true },
    }),
  ]);

  const now = new Date();
  const minDuration = shortestService._min.durationMinutes || duration;
  const allSlots = [];

  for (const emp of employees) {
    const empHours = await prisma.workingHours.findFirst({
      where: { businessId, employeeId: emp.id, serviceId: null, dayOfWeek: dow },
    });
    const hoursRecords = [businessHours, serviceHours, empHours];
    const workingWindow = effectiveWorkingWindow(hoursRecords);
    if (!workingWindow) continue;

    const busyIntervals = [
      ...breakIntervals(hoursRecords),
      ...appointments
        .filter((appointment) => appointment.employeeId === emp.id)
        .map((appointment) => intervalFromDates(appointment.startAt, appointment.endAt, "appointment", dayStart, dayEnd)),
      ...blocked
        .filter((item) => item.employeeId === null || item.employeeId === emp.id)
        .map((item) => intervalFromDates(item.startAt, item.endAt, "blocked", dayStart, dayEnd)),
    ];
    const freeIntervals = buildFreeIntervals({
      workingIntervals: [workingWindow],
      busyIntervals,
    });
    const candidates = generateDynamicCandidates({
      freeIntervals,
      durationMinutes: duration,
      minDuration,
    });

    for (const candidate of candidates) {
      const slotStart = dateAtMinutes(date, candidate.start_time);
      if (slotStart <= now) continue;
      allSlots.push({
        time: minutesToHHMM(candidate.start_time),
        startAt: slotStart,
        endAt: dateAtMinutes(date, candidate.end_time),
        employeeId: emp.id,
        employeeName: emp.name,
        priority: candidate.priority,
      });
    }
  }

  allSlots.sort((a, b) => a.priority - b.priority || a.startAt - b.startAt || a.employeeId - b.employeeId);
  const slotsByTime = new Map();
  for (const slot of allSlots) {
    if (!slotsByTime.has(slot.time)) slotsByTime.set(slot.time, slot);
  }
  return [...slotsByTime.values()]
    .sort((a, b) => a.startAt - b.startAt)
    .map(({ priority, ...slot }) => slot);
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

  const createInsideTransaction = async (tx) => {
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
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(createInsideTransaction, {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === 3) throw error;
    }
  }

  throw ApiError.conflict("تعذر تثبيت الموعد بسبب حجز متزامن، يرجى المحاولة مجددًا");
}

/**
 * تحقق شامل من إمكانية حجز فتحة: ساعات العمل + عدم التداخل + الأوقات المغلقة.
 * يُستخدم عند إنشاء الحجز وعند إعادة الجدولة. يقبل عميل Prisma أو transaction client.
 * @param {*} client prisma أو tx
 * @param {{businessId:number, employeeId:number, start:Date, end:Date, excludeId?:number}} opts
 */
export async function assertSlotAvailable(client, { businessId, employeeId, serviceId = null, start, end, excludeId = null }) {
  const dow = start.getDay();
  const dateStr = formatDate(start);
  const businessWh = await client.workingHours.findFirst({ where: { businessId, employeeId: null, serviceId: null, dayOfWeek: dow } });
  const fullyBlocked = await isBusinessFullyBlocked(client, businessId, dateStr);
  if (!businessWh || businessWh.isClosed || fullyBlocked) {
    throw ApiError.badRequest("المحل مغلق اليوم نستميحكم عذرا");
  }
  const serviceHours = serviceId ? await getServiceHours(client, businessId, serviceId, dow) : null;
  const employeeWh = await client.workingHours.findFirst({ where: { businessId, employeeId, serviceId: null, dayOfWeek: dow } });
  const hoursRecords = [businessWh, serviceHours, employeeWh];
  const workingWindow = effectiveWorkingWindow(hoursRecords);
  if (!workingWindow) {
    throw ApiError.badRequest("Business is closed at this time");
  }
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  if (startMin < workingWindow.start_time || endMin > workingWindow.end_time) {
    throw ApiError.badRequest("الوقت المختار خارج ساعات عمل المحل");
  }
  if (breakIntervals(hoursRecords).some((interval) => (
    startMin < interval.end_time && endMin > interval.start_time
  ))) {
    throw ApiError.badRequest("هذا الوقت ضمن وقت الاستراحة وغير متاح للحجز");
  }

  const { start: dayStart, end: dayEnd } = dayBounds(dateStr);
  const [appointments, blocked, shortestService] = await Promise.all([
    client.appointment.findMany({
      where: {
        businessId,
        employeeId,
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    client.blockedTime.findMany({
      where: {
        businessId,
        OR: [{ employeeId: null }, { employeeId }],
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
    }),
    client.service.aggregate({
      where: { businessId, isActive: true },
      _min: { durationMinutes: true },
    }),
  ]);

  if (appointments.some((appointment) => overlaps(start, end, appointment.startAt, appointment.endAt))) {
    throw ApiError.conflict("هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر");
  }
  if (blocked.some((interval) => overlaps(start, end, interval.startAt, interval.endAt))) {
    throw ApiError.conflict("هذا الوقت مغلق وغير متاح للحجز");
  }

  const busyIntervals = [
    ...breakIntervals(hoursRecords),
    ...appointments.map((appointment) => intervalFromDates(appointment.startAt, appointment.endAt, "appointment", dayStart, dayEnd)),
    ...blocked.map((interval) => intervalFromDates(interval.startAt, interval.endAt, "blocked", dayStart, dayEnd)),
  ];
  const freeIntervals = buildFreeIntervals({
    workingIntervals: [workingWindow],
    busyIntervals,
  });
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const minDuration = shortestService._min.durationMinutes || durationMinutes;
  const validCandidate = generateDynamicCandidates({
    freeIntervals,
    durationMinutes,
    minDuration,
  }).some((candidate) => candidate.start_time === startMin && candidate.end_time === endMin);

  if (!validCandidate) {
    throw ApiError.conflict("هذا الوقت يترك فجوة قصيرة غير قابلة للحجز، يرجى اختيار وقت مقترح آخر");
  }
}
