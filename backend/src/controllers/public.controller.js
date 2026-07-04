import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { getAvailability, createAppointmentSafe, getBusinessClosureInfo } from "../services/availability.service.js";
import { generateReference, initiateOnlinePayment } from "../services/paymentService.js";
import { assertActiveSubscription } from "../services/subscription.service.js";
import { logAudit, AUDIT } from "../services/audit.service.js";
import { normalizeWhatsappPhone, sendWhatsappText } from "../services/whatsapp.service.js";
import { env } from "../config/env.js";
import { updateCustomerProfile } from "../services/customer.service.js";
import { ensureBusinessFeatureColumns, ensureCustomerProfileColumns } from "../services/databaseMaintenance.service.js";

// …״®״·‘״· ״§„״×״­‚‚ …† ״¨״§†״§״× ״§„״­״¬״² ״§„״¹״§… (״±״³״§״¦„ ״¹״±״¨״© ˆ״§״¶״­״©)
const bookingSchema = z.object({
  serviceId: z.coerce.number({ invalid_type_error: "״§„״®״¯…״© …״·„ˆ״¨״©" }).int().positive("״§„״®״¯…״© …״·„ˆ״¨״©"),
  employeeId: z.coerce.number().int().positive().nullish(), // ״§״®״×״§״± = ״£ …ˆ״¸ …״×״§״­
  startAt: z.string({ required_error: "״§„״×״§״±״® ˆ״§„ˆ‚״× …״·„ˆ״¨״§†" }).min(1, "״§„״×״§״±״® ˆ״§„ˆ‚״× …״·„ˆ״¨״§†"),
  customerName: z.string({ required_error: "״§„״§״³… …״·„ˆ״¨" }).trim().min(2, "״§„״§״³… …״·„ˆ״¨"),
  customerPhone: z
    .string({ required_error: "״±‚… ״§„‡״§״× …״·„ˆ״¨" })
    .trim()
    .min(6, "״±‚… ״§„‡״§״× ״÷״± ״µ״§„״­")
    .max(20, "״±‚… ״§„‡״§״× ״÷״± ״µ״§„״­"),
  customerEmail: z.string().email("״¨״±״¯ ״¥„ƒ״×״±ˆ† ״÷״± ״µ״§„״­").nullish().or(z.literal("")),
  customerDateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الميلاد غير صالح").nullish().or(z.literal("")),
  paymentMethod: z.enum(["ONLINE", "PAY_AT_STORE"], { message: "״·״±‚״© ״¯״¹ ״÷״± ״µ״§„״­״©" }).nullish(),
  phoneVerificationToken: z.string().trim().min(10, "يجب تأكيد رقم الهاتف عبر واتساب").nullish(),
  notes: z.string().max(500, "״§„…„״§״­״¸״§״× ״·ˆ„״© ״¬״¯‹״§").nullish(),
});

// ״­ˆ‘„ slug ״¥„‰ …״­„ …״¹‘„״ ˆ״¶״¹ businessId  req. (״¹״²„ „„…״³״§״±״§״× ״§„״¹״§…״©)
const reviewSchema = z.object({
  serviceRating: z.coerce.number().min(0.5).max(5),
  employeeRating: z.coerce.number().min(0.5).max(5),
  businessRating: z.coerce.number().min(0.5).max(5),
  comment: z.string().max(1000).nullish().or(z.literal("")),
});

const phoneVerificationSchema = z.object({
  phone: z.string({ required_error: "رقم الهاتف مطلوب" }).trim().min(6, "رقم الهاتف غير صالح").max(20, "رقم الهاتف غير صالح"),
});

const phoneVerificationConfirmSchema = phoneVerificationSchema.extend({
  code: z.string({ required_error: "رمز التحقق مطلوب" }).trim().regex(/^\d{4,8}$/, "رمز التحقق غير صالح"),
});

const customerProfileSchema = z.object({
  phone: z.string({ required_error: "رقم الهاتف مطلوب" }).trim().min(6, "رقم الهاتف غير صالح").max(20, "رقم الهاتف غير صالح"),
  name: z.string().trim().min(2, "الاسم مطلوب").max(100).nullish().or(z.literal("")),
  email: z.string().email("البريد الإلكتروني غير صالح").nullish().or(z.literal("")),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الميلاد غير صالح").nullish().or(z.literal("")),
});

function assertLocalMobilePhone(phone) {
  const cleaned = String(phone || "").replace(/[\s-]/g, "");
  if (!/^05\d{8}$/.test(cleaned)) {
    throw ApiError.badRequest("الرقم خاطئ");
  }
  return cleaned;
}

function normalizeRating(value) {
  return Math.round(Number(value) * 2) / 2;
}

async function resolveBusinessBySlug(slug) {
  await ensureBusinessFeatureColumns(prisma);
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw ApiError.notFound("״§„…״­„ ״÷״± …ˆ״¬ˆ״¯");
  if (!business.isActive) throw ApiError.forbidden("‡״°״§ ״§„…״­„ ״÷״± …״×״§״­ ״­״§„‹״§");
  return business;
}

export const sendPhoneVerification = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const { phone } = validate(phoneVerificationSchema, req.body);
  const localPhone = assertLocalMobilePhone(phone);
  const normalizedPhone = normalizeWhatsappPhone(localPhone);

  if (env.disablePhoneVerification) {
    return res.json({
      success: true,
      verified: true,
      token: `verification-disabled-${crypto.randomBytes(12).toString("hex")}`,
      message: "تم تعطيل التحقق مؤقتًا للتجربة. يمكنك المتابعة للحجز.",
    });
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.phoneVerification.create({
    data: {
      businessId: business.id,
      phone: normalizedPhone,
      code,
      expiresAt,
    },
  });

  const whatsapp = await sendWhatsappText({
    to: normalizedPhone,
    message: `رمز التحقق لحجز دور في ${business.name}: ${code}\nالرمز صالح لمدة 10 دقائق.`,
  });

  res.json({
    success: true,
    whatsapp,
    devCode: process.env.NODE_ENV === "production" ? undefined : code,
    message: whatsapp.sent ? "تم إرسال رمز التحقق عبر واتساب" : "تم إنشاء رمز التحقق. فعّل واتساب الرسمي للإرسال التلقائي.",
  });
});

export const confirmPhoneVerification = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const { phone, code } = validate(phoneVerificationConfirmSchema, req.body);
  const localPhone = assertLocalMobilePhone(phone);
  const normalizedPhone = normalizeWhatsappPhone(localPhone);
  const verification = await prisma.phoneVerification.findFirst({
    where: {
      businessId: business.id,
      phone: normalizedPhone,
      purpose: "BOOKING",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) throw ApiError.badRequest("رمز التحقق غير صالح أو انتهت صلاحيته");
  if (verification.attempts >= 5) throw ApiError.badRequest("تم تجاوز عدد المحاولات المسموح");
  if (verification.code !== code) {
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest("رمز التحقق غير صحيح");
  }

  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.phoneVerification.update({
    where: { id: verification.id },
    data: { token, verifiedAt: new Date() },
  });
  res.json({ success: true, verified: true, token });
});

async function assertPhoneVerification({ businessId, phone, token }) {
  const localPhone = assertLocalMobilePhone(phone);
  if (env.disablePhoneVerification) return null;
  const normalizedPhone = normalizeWhatsappPhone(localPhone);
  const verification = await prisma.phoneVerification.findFirst({
    where: {
      businessId,
      phone: normalizedPhone,
      token,
      purpose: "BOOKING",
      usedAt: null,
      verifiedAt: { not: null },
      expiresAt: { gt: new Date() },
    },
  });
  if (!verification) throw ApiError.badRequest("يجب تأكيد رقم الهاتف عبر واتساب قبل الحجز");
  return verification;
}

// GET /api/public/:slug ג€” …״¹„ˆ…״§״× ״§„…״­„ + ״§„״®״¯…״§״× + ״§„…ˆ״¸ˆ†
export const getPublicBusiness = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);

  const [services, employees, reviews] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, description: true, imageUrl: true, durationMinutes: true, price: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, title: true, services: { select: { serviceId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.review.findMany({
      where: { businessId: business.id },
      select: { businessRating: true, employeeRating: true, employeeId: true },
    }),
  ]);
  const avg = (values) => {
    const nums = values.map(Number).filter(Number.isFinite);
    if (!nums.length) return null;
    return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10;
  };
  const businessRating = avg(reviews.map((review) => review.businessRating));
  const employeeRatings = new Map();
  reviews.forEach((review) => {
    const list = employeeRatings.get(review.employeeId) || [];
    list.push(review.employeeRating);
    employeeRatings.set(review.employeeId, list);
  });

  res.json({
    success: true,
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      phone: business.phone,
      address: business.address,
      mapUrl: business.mapUrl,
      logoUrl: business.logoUrl,
      bookingHeroImageUrl: business.bookingHeroImageUrl,
      brandColor: business.brandColor,
      onlinePaymentEnabled: business.onlinePaymentEnabled,
      payAtStoreEnabled: business.payAtStoreEnabled,
      requiresAppointmentApproval: business.requiresAppointmentApproval,
      printScreenEnabled: business.printScreenEnabled,
      reviewsEnabled: business.reviewsEnabled,
      averageRating: businessRating,
      reviewsCount: reviews.length,
    },
    services,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      title: e.title,
      serviceIds: e.services.map((s) => s.serviceId),
      averageRating: avg(employeeRatings.get(e.id) || []),
      reviewsCount: (employeeRatings.get(e.id) || []).length,
    })),
  });
});

// GET /api/public/:slug/availability?serviceId=&employeeId=&date=YYYY-MM-DD
export const getPublicAvailability = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const { serviceId, employeeId, date } = req.query;
  if (!serviceId) throw ApiError.badRequest("״§״®״×״± ״§„״®״¯…״© ״£ˆ„‹״§");

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

// POST /api/public/:slug/appointments ג€” ״¥†״´״§״¡ ״­״¬״² ״¨״¯ˆ† ״×״³״¬„ ״¯״®ˆ„
export const createPublicAppointment = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  // ״×״­‚‚ ״µ״§״±… …† ״§„…״¯״®„״§״×
  const data = validate(bookingSchema, req.body);
  const { serviceId, employeeId, startAt, customerName, customerPhone, customerEmail, customerDateOfBirth, notes, phoneVerificationToken } = data;
  let { paymentMethod } = data;

  // „״§ …ƒ† ״§„״­״¬״² ״¥״°״§ ״§†״×‡‰ ״§״´״×״±״§ƒ ״§„…״­„
  await assertActiveSubscription(business.id);
  await assertPhoneVerification({ businessId: business.id, phone: customerPhone, token: phoneVerificationToken });

  // ===== ״×״­״¯״¯ ״·״±‚״© ״§„״¯״¹ ˆ‚ ״¥״¹״¯״§״¯״§״× ״§„…״­„ =====
  const methods = [];
  if (business.onlinePaymentEnabled) methods.push("ONLINE");
  if (business.payAtStoreEnabled) methods.push("PAY_AT_STORE");

  if (methods.length === 0) {
    throw ApiError.badRequest("״§„״­״¬״² ״÷״± …״×״§״­ ״­״§„‹״§: „… ״¹‘„ ״§„…״­„ ״£ ״·״±‚״© ״¯״¹");
  }
  if (!paymentMethod) {
    // ״·״±‚״© ˆ״§״­״¯״© ‚״· …״¹‘„״© => ״×״®״×״§״± ״×„‚״§״¦‹״§
    if (methods.length === 1) paymentMethod = methods[0];
    else throw ApiError.badRequest("״±״¬‰ ״§״®״×״§״± ״·״±‚״© ״§„״¯״¹");
  }
  if (!methods.includes(paymentMethod)) {
    throw ApiError.badRequest("״·״±‚״© ״§„״¯״¹ ״§„…״®״×״§״±״© ״÷״± …״×״§״­״© „״¯‰ ‡״°״§ ״§„…״­„");
  }

  // ״¥† „… ״®״×״± …ˆ״¸״ †״®״×״§״± ״£ˆ„ …ˆ״¸ …״×״§״­  ״°„ƒ ״§„ˆ‚״×
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
    if (!match) throw ApiError.conflict("„… ״¹״¯ ‡״°״§ ״§„ˆ‚״× …״×״§״­‹״§");
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

  if (customerDateOfBirth !== undefined) {
    await ensureCustomerProfileColumns(prisma);
    await updateCustomerProfile(prisma, {
      businessId: business.id,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      dateOfBirth: customerDateOfBirth,
    });
  }

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
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    status: appointment.status,
    paymentMethod: appointment.paymentMethod,
    paymentStatus: appointment.paymentStatus,
    paymentAmount: appointment.paymentAmount,
  };
  const appointmentMessage = appointment.status === "PENDING"
    ? "تم إرسال طلبك بنجاح، وهو الآن قيد الانتظار حتى تتم مراجعته من المحل"
    : "تم تأكيد الحجز بنجاح";

  // ״§„״¯״¹ ״§„״¥„ƒ״×״±ˆ†: ††״´״¦ ״¬„״³״© ״¯״¹ ˆ†״¹״¯ ״±״§״¨״· ״§„״¨ˆ״§״¨״© „״×ˆ״¬‡ ״§„״²״¨ˆ†.
  if (paymentMethod === "ONLINE" && appointment.status !== "PENDING") {
    const { paymentUrl } = await initiateOnlinePayment(appointment);
    return res.status(201).json({
      success: true,
      requiresPayment: true,
      paymentUrl,
      reference: paymentReference,
      message: appointmentMessage,
      appointment: base,
    });
  }

  // ״§„״¯״¹  ״§„…״­„: ״§„״­״¬״² …״₪ƒ‘״¯ …״¨״§״´״±״©.
  res.status(201).json({
    success: true,
    requiresPayment: false,
    message: appointmentMessage,
    appointment: base,
  });
});

// GET /api/public/:slug/appointments/by-phone?phone=
export const findAppointmentByPhone = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const phone = String(req.query.phone || "").trim();
  const normalizedPhone = phone.replace(/\D/g, "");

  if (normalizedPhone.length < 6) {
    throw ApiError.badRequest("״±‚… ״§„‡״§״× ״÷״± ״µ״§„״­");
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      status: "CONFIRMED",
      startAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });

  const customerAppointments = appointments.filter((item) => item.customerPhone.replace(/\D/g, "") === normalizedPhone);
  if (!customerAppointments.length) {
    return res.json({ success: true, appointment: null, appointments: [], customer: null });
  }
  await ensureCustomerProfileColumns(prisma);
  const customer = await prisma.customer.findUnique({
    where: { businessId_phone: { businessId: business.id, phone: normalizedPhone } },
    select: { name: true, phone: true, email: true, dateOfBirth: true },
  }).catch(() => null);

  const mapAppointment = (appointment) => ({
    id: appointment.id,
    business: business.name,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    service: appointment.service.name,
    employee: appointment.employee.name,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    status: appointment.status,
    paymentMethod: appointment.paymentMethod,
    paymentStatus: appointment.paymentStatus,
    paymentAmount: appointment.paymentAmount,
  });

  res.json({
    success: true,
    appointment: mapAppointment(customerAppointments[0]),
    appointments: customerAppointments.map(mapAppointment),
    customer: {
      name: customer?.name || customerAppointments[0].customerName,
      phone: customer?.phone || customerAppointments[0].customerPhone,
      email: customer?.email || "",
      dateOfBirth: customer?.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : "",
    },
  });
});

// PATCH /api/public/:slug/customer-profile
export const updatePublicCustomerProfile = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const data = validate(customerProfileSchema, req.body);
  const localPhone = assertLocalMobilePhone(data.phone);
  await ensureCustomerProfileColumns(prisma);
  const customer = await updateCustomerProfile(prisma, {
    businessId: business.id,
    phone: localPhone,
    name: data.name,
    email: data.email,
    dateOfBirth: data.dateOfBirth,
  });
  res.json({
    success: true,
    customer: customer ? {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : "",
    } : null,
  });
});

// DELETE /api/public/:slug/appointments/:id ג€” ״¥„״÷״§״¡ ״­״¬״² ‚״§״¦… …† ״·״± ״§„״²״¨ˆ†
export const cancelPublicAppointment = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  const id = Number(req.params.id);
  const phone = String(req.body?.phone || req.query.phone || "").trim();
  const normalizedPhone = phone.replace(/\D/g, "");

  if (!Number.isInteger(id)) throw ApiError.badRequest("…״¹״± ״§„״­״¬״² ״÷״± ״µ״§„״­");
  if (normalizedPhone.length < 6) throw ApiError.badRequest("״±‚… ״§„‡״§״× ״÷״± ״µ״§„״­");

  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: business.id },
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });
  if (!appointment) throw ApiError.notFound("״§„״­״¬״² ״÷״± …ˆ״¬ˆ״¯");
  if (appointment.customerPhone.replace(/\D/g, "") !== normalizedPhone) {
    throw ApiError.forbidden("„״§ …ƒ† ״¥„״÷״§״¡ ‡״°״§ ״§„״­״¬״² …† ‡״°״§ ״§„״±‚…");
  }
  if (appointment.status === "CANCELLED") {
    return res.json({ success: true, appointment });
  }
  if (["COMPLETED", "NO_SHOW"].includes(appointment.status) || new Date(appointment.endAt) <= new Date()) {
    throw ApiError.badRequest("„״§ …ƒ† ״¥„״÷״§״¡ ״­״¬״² ״§†״×‡‰ ˆ‚״×‡");
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      ...(appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID"
        ? { paymentStatus: "REFUNDED" }
        : {}),
      notes: [appointment.notes, "״£„״÷״§‡ ״§„״²״¨ˆ† …† ״µ״­״© ״§„״­״¬״² ״§„״¹״§…״©"].filter(Boolean).join("\n"),
    },
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });

  await Promise.all([
    logAudit({
      businessId: business.id,
      actorName: appointment.customerName,
      action: AUDIT.BOOKING_CANCELLED,
      entityType: "Appointment",
      entityId: appointment.id,
      meta: { by: "customer", service: appointment.service.name },
    }),
    prisma.notification.create({
      data: {
        businessId: business.id,
        type: "CUSTOMER",
        message: `״×… ״¥„״÷״§״¡ ״­״¬״² ״§„״²״¨ˆ† ${appointment.customerName} …† ״µ״­״© ״§„״­״¬״² ״§„״¹״§…״©`,
      },
    }),
  ]);

  res.json({
    success: true,
    appointment: {
      id: updated.id,
      business: business.name,
      startAt: updated.startAt,
      endAt: updated.endAt,
      service: updated.service.name,
      employee: updated.employee.name,
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      status: updated.status,
      paymentMethod: updated.paymentMethod,
      paymentStatus: updated.paymentStatus,
      paymentAmount: updated.paymentAmount,
    },
  });
});

// GET /api/public/:slug/print-ticket?phone=
export const getPrintTicket = asyncHandler(async (req, res) => {
  const business = await resolveBusinessBySlug(req.params.slug);
  if (!business.printScreenEnabled) {
    throw ApiError.forbidden("״´״§״´״© ״§„״·״¨״§״¹״© ״÷״± …״¹„״© „‡״°״§ ״§„…״­„");
  }

  const phone = String(req.query.phone || "").trim();
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 6) {
    throw ApiError.badRequest("״±‚… ״§„‡״§״× ״÷״± ״µ״§„״­");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: todayStart, lt: tomorrowStart },
    },
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });

  const customerAppointments = appointments.filter((item) => item.customerPhone.replace(/\D/g, "") === normalizedPhone);
  const now = new Date();
  const appointment =
    customerAppointments.find((item) => item.endAt >= now) ||
    customerAppointments[0];

  if (!appointment) {
    return res.json({
      success: true,
      ticket: null,
      message: "„״§ ˆ״¬״¯ ״¯ˆ״± „‡״°״§ ״§„״±‚… ״§„ˆ…",
      business: {
        name: business.name,
        logoUrl: business.logoUrl,
        brandColor: business.brandColor,
      },
    });
  }

  if (appointment.status === "PENDING") {
    return res.json({
      success: true,
      ticket: null,
      message: "״§„״­״¬״² …ˆ״¬ˆ״¯ „ƒ†‡ …״§ ״²״§„ ״¨״§†״×״¸״§״± ״§„״×״£ƒ״¯ …† ״§„…״­„",
      business: {
        name: business.name,
        logoUrl: business.logoUrl,
        brandColor: business.brandColor,
      },
    });
  }

  const confirmedAppointments = appointments.filter((item) => item.status === "CONFIRMED");
  const index = confirmedAppointments.findIndex((item) => item.id === appointment.id);
  if (index === -1) throw ApiError.notFound("„… ״×… ״§„״¹״«ˆ״± ״¹„‰ ״§„״¯ˆ״± ״§„…״₪ƒ״¯ „‡״°״§ ״§„״±‚…");
  const peopleAhead = Math.max(0, index);
  const bookingNumber = index + 1;

  res.json({
    success: true,
    ticket: {
      queueNumber: index + 1,
      peopleAhead,
      bookingNumber,
      appointmentId: appointment.id,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      service: appointment.service.name,
      employee: appointment.employee.name,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      queueRule: "״­״³״¨ ˆ‚״× ״§„…ˆ״¹״¯  ״¬״¯ˆ„ ״§„ˆ…",
    },
    business: {
      name: business.name,
      logoUrl: business.logoUrl,
      brandColor: business.brandColor,
    },
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
        ? `״§„״²״¨ˆ† ${appointment.customerName} ˆ״§‚ ״¹„‰ ״§„ˆ‚״× ״§„״¬״¯״¯`
        : `״§„״²״¨ˆ† ${appointment.customerName} ״±״¶ ״§„ˆ‚״× ״§„״¬״¯״¯ ˆ״×… ״¥״±״§״÷ ״§„״¯ˆ״±`,
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

// GET /api/public/reviews/:token
export const getPublicReview = asyncHandler(async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { reviewToken: req.params.token },
    include: {
      business: { select: { name: true, logoUrl: true, brandColor: true, reviewsEnabled: true } },
      service: { select: { name: true } },
      employee: { select: { name: true, title: true } },
      review: true,
    },
  });
  if (!appointment) throw ApiError.notFound("״±״§״¨״· ״§„״×‚… ״÷״± ״µ״§„״­");
  if (!appointment.business.reviewsEnabled) throw ApiError.forbidden("†״¸״§… ״§„״×‚…״§״× ״÷״± …״¹‘„");
  if (appointment.status !== "COMPLETED") throw ApiError.badRequest("„״§ …ƒ† ״×‚… ״­״¬״² ״÷״± …ƒ״×…„");

  res.json({
    success: true,
    alreadyReviewed: Boolean(appointment.review),
    appointment: {
      id: appointment.id,
      customerName: appointment.customerName,
      startAt: appointment.startAt,
      service: appointment.service.name,
      employee: appointment.employee.name,
      employeeTitle: appointment.employee.title,
      business: appointment.business,
    },
  });
});

// POST /api/public/reviews/:token
export const submitPublicReview = asyncHandler(async (req, res) => {
  const data = validate(reviewSchema, req.body);
  const appointment = await prisma.appointment.findUnique({
    where: { reviewToken: req.params.token },
    include: {
      business: { select: { reviewsEnabled: true } },
      review: true,
    },
  });
  if (!appointment) throw ApiError.notFound("״±״§״¨״· ״§„״×‚… ״÷״± ״µ״§„״­");
  if (!appointment.business.reviewsEnabled) throw ApiError.forbidden("†״¸״§… ״§„״×‚…״§״× ״÷״± …״¹‘„");
  if (appointment.status !== "COMPLETED") throw ApiError.badRequest("„״§ …ƒ† ״×‚… ״­״¬״² ״÷״± …ƒ״×…„");
  if (appointment.review) throw ApiError.conflict("״×… ״×‚… ‡״°״§ ״§„״­״¬״² …״³״¨‚‹״§");

  const review = await prisma.review.create({
    data: {
      appointmentId: appointment.id,
      businessId: appointment.businessId,
      serviceId: appointment.serviceId,
      employeeId: appointment.employeeId,
      serviceRating: normalizeRating(data.serviceRating),
      employeeRating: normalizeRating(data.employeeRating),
      businessRating: normalizeRating(data.businessRating),
      comment: data.comment?.trim() || null,
    },
  });

  await prisma.notification.create({
    data: {
      businessId: appointment.businessId,
      type: "CUSTOMER",
      message: `ˆ״µ„ ״×‚… ״¬״¯״¯ …† ״§„״²״¨ˆ† ${appointment.customerName}`,
    },
  });

  res.status(201).json({ success: true, review });
});


