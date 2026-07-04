import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "../services/mail.service.js";
import { ensurePasswordResetTable } from "../services/databaseMaintenance.service.js";
import crypto from "crypto";

const businessSessionSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  brandColor: true,
  isActive: true,
  printScreenEnabled: true,
  customerHubEnabled: true,
  customerPointsPercent: true,
  reviewsEnabled: true,
};

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw ApiError.badRequest("البريد وكلمة المرور مطلوبان");
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: {
      business: { select: businessSessionSelect },
      employeeProfile: { select: { id: true, role: true, name: true, title: true } },
    },
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw ApiError.unauthorized("بيانات الدخول غير صحيحة");
  }
  if (!user.isActive) throw ApiError.forbidden("الحساب معطّل");

  // إن كان المستخدم تابعًا لمحل، تأكد أن المحل مفعّل (عدا الأدمن)
  if (user.role !== "SUPER_ADMIN" && user.business && !user.business.isActive) {
    throw ApiError.forbidden("المحل معطّل، تواصل مع الإدارة");
  }

  const token = signToken({ sub: user.id, role: user.role, businessId: user.businessId });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffRole: user.employeeProfile?.role || null,
      employeeProfile: user.employeeProfile || null,
      businessId: user.businessId,
      business: user.business || null,
    },
  });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessId: true,
      employeeProfile: { select: { id: true, role: true, name: true, title: true } },
      business: { select: businessSessionSelect },
    },
  });
  res.json({ success: true, user: { ...user, staffRole: user.employeeProfile?.role || null } });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  await ensurePasswordResetTable(prisma);

  const email = normalizeEmail(req.body?.email);
  if (!email) throw ApiError.badRequest("البريد الإلكتروني مطلوب");

  const genericMessage = "إذا كان البريد موجودًا لدينا فستصل رسالة تحتوي على رابط تغيير كلمة السر";
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return res.json({ success: true, message: genericMessage });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      "UPDATE `password_reset_tokens` SET `used_at` = NOW(3) WHERE `user_id` = ? AND `used_at` IS NULL",
      user.id,
    ),
    prisma.$executeRawUnsafe(
      "INSERT INTO `password_reset_tokens` (`user_id`, `token_hash`, `expires_at`) VALUES (?, ?, ?)",
      user.id,
      tokenHash,
      expiresAt,
    ),
  ]);

  const resetUrl = `${env.clientUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  const mailResult = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

  res.json({
    success: true,
    message: genericMessage,
    ...(!env.isProd && mailResult.devResetUrl ? { devResetUrl: mailResult.devResetUrl } : {}),
  });
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  await ensurePasswordResetTable(prisma);

  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");
  if (!token || !password) throw ApiError.badRequest("الرابط وكلمة السر الجديدة مطلوبان");
  if (password.length < 6) throw ApiError.badRequest("كلمة السر يجب أن تكون 6 أحرف على الأقل");

  const tokenHash = hashResetToken(token);
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `id`, `user_id` AS userId, `expires_at` AS expiresAt, `used_at` AS usedAt FROM `password_reset_tokens` WHERE `token_hash` = ? LIMIT 1",
    tokenHash,
  );
  const resetRow = rows?.[0];

  if (!resetRow || resetRow.usedAt || new Date(resetRow.expiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest("رابط استعادة كلمة السر غير صالح أو انتهت صلاحيته");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: Number(resetRow.userId) },
      data: { passwordHash, loginPassword: password },
    }),
    prisma.$executeRawUnsafe(
      "UPDATE `password_reset_tokens` SET `used_at` = NOW(3) WHERE `id` = ?",
      Number(resetRow.id),
    ),
  ]);

  res.json({ success: true, message: "تم تغيير كلمة السر بنجاح. يمكنك تسجيل الدخول الآن" });
});
