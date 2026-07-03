import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export function notFound(req, _res, next) {
  next(ApiError.notFound(`المسار غير موجود: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "حدث خطأ في الخادم";
  let details = err.details || null;

  if (err.code === "P2000") {
    statusCode = 413;
    message = "حجم البيانات المرسلة أكبر من المسموح. يرجى اختيار صورة أصغر أو ضغط الصورة ثم المحاولة مرة أخرى.";
    details = err.meta?.column_name || err.meta;
  } else if (err.code === "P2002") {
    statusCode = 409;
    message = "هذه القيمة مستخدمة مسبقًا ولا يمكن تكرارها.";
    details = err.meta?.target;
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "السجل المطلوب غير موجود";
  } else if (err.code === "P2003") {
    statusCode = 409;
    message = "لا يمكن إتمام العملية بسبب ارتباطها بسجلات أخرى";
  }

  if (statusCode === 500 && !env.isProd) {
    console.error("خطأ في الخادم:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}
