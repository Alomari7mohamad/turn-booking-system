import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";

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
