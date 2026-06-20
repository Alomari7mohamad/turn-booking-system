import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export function notFound(req, _res, next) {
  next(ApiError.notFound(`المسار غير موجود: ${req.method} ${req.originalUrl}`));
}

// معالج الأخطاء المركزي. يحوّل أخطاء Prisma الشائعة إلى رسائل عربية واضحة.
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "حدث خطأ في الخادم";
  let details = err.details || null;

  // أخطاء Prisma المعروفة
  if (err.code === "P2002") {
    statusCode = 409;
    message = "هذه القيمة مستخدمة مسبقًا (تكرار غير مسموح)";
    details = err.meta?.target;
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "السجل المطلوب غير موجود";
  } else if (err.code === "P2003") {
    statusCode = 409;
    message = "لا يمكن إتمام العملية بسبب ارتباط بسجلات أخرى";
  }

  if (statusCode === 500 && !env.isProd) {
    // أثناء التطوير اطبع التفاصيل في الكونسول لتسهيل التشخيص
    console.error("❌", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}
