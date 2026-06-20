import { ApiError } from "../utils/ApiError.js";

// يقيّد الوصول على أدوار محددة. مثال: authorize("SUPER_ADMIN")
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("هذا الإجراء يتطلّب صلاحية أعلى"));
    }
    next();
  };
}
