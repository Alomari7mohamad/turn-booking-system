// خطأ تطبيقي موحّد يحمل status code ورسالة عربية واضحة.
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg = "طلب غير صالح", details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = "غير مصرّح بالدخول") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "ليس لديك صلاحية") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "غير موجود") {
    return new ApiError(404, msg);
  }
  static conflict(msg = "تعارض في البيانات") {
    return new ApiError(409, msg);
  }
}
