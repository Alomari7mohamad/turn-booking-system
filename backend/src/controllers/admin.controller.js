import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.js";
import { logAudit, AUDIT } from "../services/audit.service.js";

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildSubscriptionDates({ plan, startsAt, endsAt, freeMonths }) {
  const start = dateOnly(startsAt) || new Date();
  const requestedEnd = dateOnly(endsAt);
  const planDays = plan === "YEARLY" ? 365 : 30;
  const free = Number(freeMonths || 0);
  if (!Number.isFinite(free) || free < 0) {
    throw ApiError.badRequest("مدة الفترة المجانية يجب أن تكون رقمًا موجبًا");
  }
  const end = addMonths(requestedEnd || addDays(start, planDays), free);

  if (end <= start) {
    throw ApiError.badRequest("تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ البداية");
  }

  return { startsAt: start, endsAt: end };
}

// GET /api/admin/stats — لوحة التحكم العامة
export const getStats = asyncHandler(async (_req, res) => {
  const [businesses, activeBusinesses, appointments, owners] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    prisma.appointment.count(),
    prisma.user.count({ where: { role: "BUSINESS_OWNER" } }),
  ]);

  // أحدث المحلات مع عدد حجوزاتها
  const recent = await prisma.business.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { appointments: true } } },
  });

  res.json({
    success: true,
    stats: { businesses, activeBusinesses, appointments, owners },
    recent: recent.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      isActive: b.isActive,
      appointments: b._count.appointments,
    })),
  });
});

// GET /api/admin/managers — إدارة المدراء
export const listManagers = asyncHandler(async (_req, res) => {
  const managers = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, phone: true, email: true, isActive: true, createdAt: true },
  });
  res.json({ success: true, managers });
});

// POST /api/admin/managers — إضافة مدير
export const createManager = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !email || !password) {
    throw ApiError.badRequest("اسم المدير والبريد الإلكتروني وكلمة السر مطلوبة");
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (taken) throw ApiError.conflict("البريد الإلكتروني مستخدم مسبقًا");

  const manager = await prisma.user.create({
    data: {
      businessId: null,
      name,
      phone: phone || null,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: "SUPER_ADMIN",
    },
    select: { id: true, name: true, phone: true, email: true, isActive: true, createdAt: true },
  });
  res.status(201).json({ success: true, manager });
});

// PATCH /api/admin/managers/:id — تعديل مدير
export const updateManager = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.user.findFirst({ where: { id, role: "SUPER_ADMIN" } });
  if (!existing) throw ApiError.notFound("المدير غير موجود");

  const { name, phone, email, password } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone || null;
  if (email !== undefined) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const taken = await prisma.user.findFirst({ where: { email: normalizedEmail, id: { not: id } } });
    if (taken) throw ApiError.conflict("البريد الإلكتروني مستخدم مسبقًا");
    data.email = normalizedEmail;
  }
  if (password) data.passwordHash = await hashPassword(password);

  const manager = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, phone: true, email: true, isActive: true, createdAt: true },
  });
  res.json({ success: true, manager });
});

// GET /api/admin/businesses — كل المحلات + عدد الحجوزات + الاشتراك الحالي
export const listBusinesses = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const businesses = await prisma.business.findMany({
    where: search ? { name: { contains: search } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { appointments: true, employees: true, services: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      users: {
        where: { role: "BUSINESS_OWNER" },
        select: { id: true, name: true, email: true, loginPassword: true },
        take: 1,
      },
    },
  });

  res.json({
    success: true,
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      email: b.email,
      phone: b.phone,
      address: b.address,
      logoUrl: b.logoUrl,
      brandColor: b.brandColor,
      requiresAppointmentApproval: b.requiresAppointmentApproval,
      isActive: b.isActive,
      createdAt: b.createdAt,
      counts: b._count,
      owner: b.users[0] || null,
      subscription: b.subscriptions[0] || null,
    })),
  });
});

// GET /api/admin/businesses/:id
export const getBusiness = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      _count: { select: { appointments: true, employees: true, services: true } },
      subscriptions: { orderBy: { createdAt: "desc" } },
      users: { where: { role: "BUSINESS_OWNER" }, select: { id: true, name: true, email: true, loginPassword: true } },
    },
  });
  if (!business) throw ApiError.notFound("المحل غير موجود");
  res.json({ success: true, business });
});

// POST /api/admin/businesses — إنشاء محل + صاحب المحل + اشتراك
export const createBusiness = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    email,
    phone,
    address,
    logoUrl,
    brandColor,
    timezone,
    ownerName,
    ownerEmail,
    ownerPassword,
    requiresAppointmentApproval = true,
    plan = "MONTHLY",
    startsAt,
    endsAt,
    freeMonths = 0,
  } = req.body;

  if (!name || !ownerName || !ownerEmail || !ownerPassword) {
    throw ApiError.badRequest("اسم المحل وبيانات صاحب المحل مطلوبة");
  }

  const finalSlug = slugify(slug || name);

  const exists = await prisma.business.findUnique({ where: { slug: finalSlug } });
  if (exists) throw ApiError.conflict("هذا الرابط (slug) مستخدم مسبقًا");

  const emailTaken = await prisma.user.findUnique({
    where: { email: ownerEmail.toLowerCase().trim() },
  });
  if (emailTaken) throw ApiError.conflict("بريد صاحب المحل مستخدم مسبقًا");

  if (!["MONTHLY", "YEARLY"].includes(plan)) {
    throw ApiError.badRequest("نوع الاشتراك يجب أن يكون MONTHLY أو YEARLY");
  }
  const subscriptionDates = buildSubscriptionDates({ plan, startsAt, endsAt, freeMonths });

  const business = await prisma.$transaction(async (tx) => {
    const b = await tx.business.create({
      data: {
        name,
        slug: finalSlug,
        email: email || null,
        phone: phone || null,
        address: address || null,
        logoUrl: logoUrl || null,
        brandColor: brandColor || "#064e3b",
        timezone: timezone || "Asia/Riyadh",
        requiresAppointmentApproval: Boolean(requiresAppointmentApproval),
      },
    });

    await tx.user.create({
      data: {
        businessId: b.id,
        name: ownerName,
        email: ownerEmail.toLowerCase().trim(),
        passwordHash: await hashPassword(ownerPassword),
        loginPassword: ownerPassword,
        role: "BUSINESS_OWNER",
      },
    });

    await tx.subscription.create({
      data: { businessId: b.id, plan, ...subscriptionDates, status: "ACTIVE" },
    });

    // دوام افتراضي للمحل: الأحد-الخميس 09:00-17:00
    const defaults = [0, 1, 2, 3, 4].map((dayOfWeek) => ({
      businessId: b.id,
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      isClosed: false,
    }));
    // الجمعة والسبت مغلق
    defaults.push(
      { businessId: b.id, dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isClosed: true },
      { businessId: b.id, dayOfWeek: 6, startTime: "09:00", endTime: "17:00", isClosed: true }
    );
    await tx.workingHours.createMany({ data: defaults });

    return b;
  });

  res.status(201).json({ success: true, business });
});

// PATCH /api/admin/businesses/:id — تعديل بيانات المحل
export const updateBusiness = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, email, phone, address, timezone, logoUrl, brandColor, requiresAppointmentApproval, ownerName, ownerEmail, ownerPassword } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (slug !== undefined) data.slug = slugify(slug);
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (address !== undefined) data.address = address;
  if (timezone !== undefined) data.timezone = timezone;
  if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
  if (brandColor !== undefined) data.brandColor = brandColor || "#064e3b";
  if (requiresAppointmentApproval !== undefined) data.requiresAppointmentApproval = Boolean(requiresAppointmentApproval);

  const business = await prisma.$transaction(async (tx) => {
    const updated = await tx.business.update({ where: { id }, data });
    const owner = await tx.user.findFirst({ where: { businessId: id, role: "BUSINESS_OWNER" } });
    if (owner && (ownerName !== undefined || ownerEmail !== undefined || ownerPassword !== undefined)) {
      const ownerData = {};
      if (ownerName !== undefined) ownerData.name = ownerName;
      if (ownerEmail !== undefined) {
        const email = String(ownerEmail).toLowerCase().trim();
        const taken = await tx.user.findFirst({ where: { email, id: { not: owner.id } } });
        if (taken) throw ApiError.conflict("البريد الإلكتروني مستخدم مسبقًا");
        ownerData.email = email;
      }
      if (ownerPassword !== undefined) {
        ownerData.loginPassword = ownerPassword || null;
        if (ownerPassword) ownerData.passwordHash = await hashPassword(ownerPassword);
      }
      if (Object.keys(ownerData).length) await tx.user.update({ where: { id: owner.id }, data: ownerData });
    }
    return updated;
  });
  res.json({ success: true, business });
});

// PATCH /api/admin/businesses/:id/status — تفعيل/إيقاف
export const toggleBusinessStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body;
  const business = await prisma.business.update({
    where: { id },
    data: { isActive: Boolean(isActive) },
  });
  res.json({ success: true, business });
});

// PATCH /api/admin/businesses/:id/subscription — تحديد/تجديد الاشتراك
export const updateSubscription = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { plan = "MONTHLY", price = 0, startsAt, endsAt, freeMonths = 0 } = req.body;
  if (!["MONTHLY", "YEARLY"].includes(plan)) {
    throw ApiError.badRequest("نوع الاشتراك يجب أن يكون MONTHLY أو YEARLY");
  }
  const subscriptionDates = buildSubscriptionDates({ plan, startsAt, endsAt, freeMonths });

  const subscription = await prisma.subscription.create({
    data: { businessId: id, plan, price, ...subscriptionDates, status: "ACTIVE" },
  });
  res.status(201).json({ success: true, subscription });
});

// PATCH /api/admin/appointments/:id/payment — تغيير حالة الدفع لأي حجز (بما فيه الإلكتروني)
// صلاحية حصرية للـ SUPER_ADMIN.
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
export const overrideAppointmentPayment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { paymentStatus } = req.body;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    throw ApiError.badRequest("حالة دفع غير صالحة");
  }
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("الحجز غير موجود");
  if (existing.paymentStatus === "PAID" && paymentStatus !== "PAID") {
    throw ApiError.badRequest("Paid appointments cannot have their payment status changed");
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
      // عند تأكيد الدفع نؤكّد الموعد؛ عند فشله نلغيه (يتحرّر الوقت)
      ...(paymentStatus === "PAID" ? { status: "CONFIRMED" } : {}),
      ...(paymentStatus === "FAILED" ? { status: "CANCELLED" } : {}),
    },
  });
  await logAudit({
    businessId: existing.businessId,
    userId: req.user.id,
    actorName: req.user.name,
    action: AUDIT.PAYMENT_STATUS_CHANGED,
    entityType: "Appointment",
    entityId: id,
    meta: { paymentStatus, by: "super_admin" },
  });
  res.json({ success: true, appointment });
});

// إدارة أصحاب المحلات: PATCH /api/admin/businesses/:id/owner
export const upsertOwner = asyncHandler(async (req, res) => {
  const businessId = Number(req.params.id);
  const { name, email, password } = req.body;

  const existing = await prisma.user.findFirst({
    where: { businessId, role: "BUSINESS_OWNER" },
  });

  const data = {};
  if (name) data.name = name;
  if (email) data.email = email.toLowerCase().trim();
  if (password) {
    data.passwordHash = await hashPassword(password);
    data.loginPassword = password;
  }

  let owner;
  if (existing) {
    owner = await prisma.user.update({ where: { id: existing.id }, data });
  } else {
    if (!name || !email || !password) {
      throw ApiError.badRequest("اسم وبريد وكلمة مرور صاحب المحل مطلوبة");
    }
    owner = await prisma.user.create({
      data: { ...data, businessId, role: "BUSINESS_OWNER" },
    });
  }
  res.json({ success: true, owner: { id: owner.id, name: owner.name, email: owner.email } });
});
