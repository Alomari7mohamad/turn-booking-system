import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

// يحسب حالة اشتراك المحل (آخر اشتراك).
export async function getSubscriptionState(businessId) {
  const sub = await prisma.subscription.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  const active = !!sub && sub.status === "ACTIVE" && new Date(sub.endsAt) > new Date();
  return { sub, active };
}

// يرمي خطأً إن لم يكن للمحل اشتراك فعّال (يُستخدم لمنع الحجز).
export async function assertActiveSubscription(businessId) {
  const { active } = await getSubscriptionState(businessId);
  if (!active) {
    throw ApiError.forbidden("اشتراك المحل منتهٍ أو غير مفعّل حاليًا، يرجى التواصل مع المحل");
  }
}
