import { z } from "zod";
import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { getAvailability, createAppointmentSafe, getBusinessClosureInfo } from "../services/availability.service.js";
import { generateReference, initiateOnlinePayment } from "../services/paymentService.js";
import { assertActiveSubscription } from "../services/subscription.service.js";
import { logAudit, AUDIT } from "../services/audit.service.js";

// مخطّط التحقق من بيانات الحجز العام (رسائل عربية واضحة)
const bookingSchema = z.object({
  serviceId: z.coerce.number({ invalid_type_error: "الخدمة مطلوبة" }).int().positive("الخدمة مطلوبة"),
  employeeId: z.coerce.number().int().positive().nullish(), // اختياري = أي موظف متاح
  startAt: z.string({ required_error: "التاريخ والوقت مطلوبان" }).min(1, "التاريخ والوقت مطلوبان"),
  customerName: z.string({ required_error: "الاسم مطلوب" }).trim().min(2, "الاسم مطلوب"),
  customerPhone: z
    .string({ required_error: "رقم الهاتف مطلوب" })
    .trim()
    .min(6, "رقم الهاتف غير صالح")
    .max(20, "رقم الهاتف غير صالح"),
  customerEmail: z.string().email("بريد إلكتروني غير صالح").nullish().or(z.literal("")),
  paymentMethod: z.enum(["ONLINE", "PAY_AT_STORE"], { message: "طريقة دفع غير صالحة" }).nullish(),
  notes: z.string().max(500, "الملاحظات طويلة جدًا").nullish(),
});

// يحوّل slug إلى محل مفعّل، ويضع businessId في req. (عزل للمسارات العامة)
async function resolveBusinessBySlug(slug) {
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw ApiError.notFound("المحل غير موجود");
  if (!business.isActive) throw ApiError.forbidden("هذا المحل غير متاح حاليًا");
  return business;
}

// GET /api/public/:slug — معلومات المحل + الخدمات + الموظفون
export const getPublicBusiness = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);

  const [services, employees] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, description: true, durationMinutes: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, title: true, services: { select: { serviceId: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  res.json({
    success: true,
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      phone: business.phone,
      address: business.address,
      logoUrl: business.logoUrl,
      brandColor: business.brandColor,
      onlinePaymentEnabled: business.onlinePaymentEnabled,
      payAtStoreEnabled: business.payAtStoreEnabled,
    },
    services,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      title: e.title,
      serviceIds: e.services.map((s) => s.serviceId),
    })),
  });
});

// GET /api/public/:slug/availability?serviceId=&employeeId=&date=YYYY-MM-DD
export const getPublicAvailability = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const { serviceId, employeeId, date } = req.query;
  if (!serviceId) throw ApiError.badRequest("اختر الخدمة أولًا");

  const closure = await getBusinessClosureInfo({ businessId: business.id, date });
  if (closure) {
    return res.json({
      success: true,
      slots: [],
      closed: closure,
    });
  }

  const slots = await getAvailability({
    businessId: business.id,
    serviceId,
    employeeId: employeeId || null,
    date,
  });

  res.json({
    success: true,
    slots: slots.map((s) => ({
      time: s.time,
      startAt: s.startAt,
      employeeId: s.employeeId,
      employeeName: s.employeeName,
    })),
    closed: null,
  });
});

// POST /api/public/:slug/appointments — إنشاء حجز بدون تسجيل دخول
export const createPublicAppointment = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  // تحقق صارم من المدخلات
  const data = validate(bookingSchema, req.body);
  const { serviceId, employeeId, startAt, customerName, customerPhone, customerEmail, notes } = data;
  let { paymentMethod } = data;

  // لا يمكن الحجز إذا انتهى اشتراك المحل
  await assertActiveSubscription(business.id);

  // ===== تحديد طريقة الدفع وفق إعدادات المحل =====
  const methods = [];
  if (business.onlinePaymentEnabled) methods.push("ONLINE");
  if (business.payAtStoreEnabled) methods.push("PAY_AT_STORE");

  if (methods.length === 0) {
    throw ApiError.badRequest("الحجز غير متاح حاليًا: لم يفعّل المحل أي طريقة دفع");
  }
  if (!paymentMethod) {
    // طريقة واحدة فقط مفعّلة => تُختار تلقائيًا
    if (methods.length === 1) paymentMethod = methods[0];
    else throw ApiError.badRequest("يرجى اختيار طريقة الدفع");
  }
  if (!methods.includes(paymentMethod)) {
    throw ApiError.badRequest("طريقة الدفع المختارة غير متاحة لدى هذا المحل");
  }

  // إن لم يُختر موظف، نختار أول موظف متاح في ذلك الوقت
  let finalEmployeeId = employeeId;
  if (!finalEmployeeId) {
    const date = new Date(startAt).toISOString().slice(0, 10);
    const slots = await getAvailability({
      businessId: business.id,
      serviceId,
      employeeId: null,
      date,
    });
    const match = slots.find((s) => new Date(s.startAt).getTime() === new Date(startAt).getTime());
    if (!match) throw ApiError.conflict("لم يعد هذا الوقت متاحًا");
    finalEmployeeId = match.employeeId;
  }

  const paymentReference = paymentMethod === "ONLINE" ? generateReference() : null;

  const appointment = await createAppointmentSafe({
    businessId: business.id,
    serviceId,
    employeeId: finalEmployeeId,
    customerName,
    customerPhone,
    customerEmail,
    startAt,
    notes,
    paymentMethod,
    paymentReference,
    requiresApproval: business.requiresAppointmentApproval,
  });

  await logAudit({
    businessId: business.id,
    actorName: customerName,
    action: AUDIT.BOOKING_CREATED,
    entityType: "Appointment",
    entityId: appointment.id,
    meta: { service: appointment.service.name, paymentMethod, paymentStatus: appointment.paymentStatus },
  });

  const base = {
    id: appointment.id,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    service: appointment.service.name,
    employee: appointment.employee.name,
    status: appointment.status,
    paymentMethod: appointment.paymentMethod,
    paymentStatus: appointment.paymentStatus,
    paymentAmount: appointment.paymentAmount,
  };

  // الدفع الإلكتروني: ننشئ جلسة دفع ونعيد رابط البوابة لتوجيه الزبون.
  if (paymentMethod === "ONLINE") {
    const { paymentUrl } = await initiateOnlinePayment(appointment);
    return res.status(201).json({
      success: true,
      requiresPayment: true,
      paymentUrl,
      reference: paymentReference,
      message: "يرجى إتمام الدفع لتأكيد الحجز",
      appointment: base,
    });
  }

  // الدفع في المحل: الحجز مؤكَّد مباشرة.
  res.status(201).json({
    success: true,
    requiresPayment: false,
    message: "تم تأكيد الحجز بنجاح",
    appointment: base,
  });
});

// POST /api/public/appointments/:id/delay-response
export const respondToDelay = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { response } = req.body;
  if (!["ACCEPTED", "REJECTED"].includes(response)) {
    throw ApiError.badRequest("Invalid response");
  }

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) throw ApiError.notFound("Appointment not found");

  const updated = response === "REJECTED"
    ? await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } })
    : appointment;

  await prisma.notification.create({
    data: {
      businessId: appointment.businessId,
      type: "CUSTOMER_RESPONSE",
      message: response === "ACCEPTED"
        ? `الزبون ${appointment.customerName} وافق على الوقت الجديد`
        : `الزبون ${appointment.customerName} رفض الوقت الجديد وتم إفراغ الدور`,
    },
  });

  res.json({ success: true, appointment: updated });
});

// GET /api/public/appointments/:id/status
export const getAppointmentStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true, startAt: true, endAt: true },
  });
  if (!appointment) throw ApiError.notFound("Appointment not found");
  res.json({ success: true, appointment });
});
