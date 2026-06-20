import { ApiError } from "../utils/ApiError.js";

// عزل بيانات المحلات: يحدد businessId الذي يُسمح للطلب بالعمل عليه ويضعه في req.tenantId.
//
// - BUSINESS_OWNER / STAFF: businessId مقفول على محلّهم من التوكن. لا يمكنهم تجاوزه.
// - SUPER_ADMIN: لا يملك businessId خاصًا، لكنه يستطيع استهداف أي محل عبر
//   param/body (businessId) — يُستخدم في مسارات الأدمن فقط.
//
// كل استعلامات الـ controllers الخاصة بالمحل يجب أن تمرّر where: { businessId: req.tenantId }.
export function resolveTenant(req, _res, next) {
  const user = req.user;
  if (!user) return next(ApiError.unauthorized());

  if (user.role === "SUPER_ADMIN") {
    // الأدمن قد يحدد المحل صراحة (في مسارات إدارة المحلات)
    const explicit =
      req.params.businessId || req.body?.businessId || req.query?.businessId;
    req.tenantId = explicit ? Number(explicit) : null;
    req.isSuperAdmin = true;
    return next();
  }

  if (!user.businessId) {
    return next(ApiError.forbidden("الحساب غير مرتبط بأي محل"));
  }

  req.tenantId = user.businessId;
  req.isSuperAdmin = false;
  next();
}

// يضمن وجود tenantId فعلي قبل تنفيذ عملية خاصة بمحل (يمنع تسريب null).
export function requireTenant(req, _res, next) {
  if (!req.tenantId) {
    return next(ApiError.badRequest("يجب تحديد المحل (businessId)"));
  }
  next();
}
