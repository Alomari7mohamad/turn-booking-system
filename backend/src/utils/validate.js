import { ZodError } from "zod";
import { ApiError } from "./ApiError.js";

// يتحقق من البيانات عبر schema من zod ويحوّل أول خطأ إلى رسالة عربية واضحة.
export function validate(schema, data) {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.errors[0];
      throw ApiError.badRequest(first?.message || "بيانات غير صالحة", e.errors);
    }
    throw e;
  }
}
