import { prisma } from "../config/db.js";

// تسجيل حدث في سجلّ التدقيق. "best-effort": لا يجب أن يُفشِل العملية الأساسية إن فشل التسجيل.
export async function logAudit({ businessId = null, userId = null, actorName = null, action, entityType, entityId = null, meta = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        actorName,
        action,
        entityType,
        entityId: entityId != null ? Number(entityId) : null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (err) {
    console.error("⚠️  audit log failed:", err.message);
  }
}

// أنواع الأحداث الموحّدة
export const AUDIT = {
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  PAYMENT_STATUS_CHANGED: "PAYMENT_STATUS_CHANGED",
  PAYMENT_SETTINGS_CHANGED: "PAYMENT_SETTINGS_CHANGED",
  BUSINESS_SETTINGS_CHANGED: "BUSINESS_SETTINGS_CHANGED",
  WORKING_HOURS_CHANGED: "WORKING_HOURS_CHANGED",
};
