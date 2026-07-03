import crypto from "crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { mockGateway } from "./gateways/mock.gateway.js";
import { logAudit, AUDIT } from "./audit.service.js";
import { recordCustomerPayment } from "./customer.service.js";

// ============================================================
// طبقة الدفع المنفصلة. كل المنطق الخاص بالبوابة معزول هنا،
// فتبديل البوابة لاحقًا لا يمسّ بقية النظام.
// ============================================================

const GATEWAYS = {
  mock: mockGateway,
  // stripe: stripeGateway,   <- أضف بوابات حقيقية هنا
  // paytabs: paytabsGateway,
};

export function getGateway() {
  const g = GATEWAYS[env.paymentProvider];
  if (!g) throw new Error(`بوابة دفع غير معروفة: ${env.paymentProvider}`);
  return g;
}

// معرّف فريد لعملية الدفع نربطه بالموعد ونستقبله في الـ webhook.
export function generateReference() {
  return `pay_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

// يبدأ دفعة إلكترونية: ينشئ checkout لدى البوابة ويعيد رابط الدفع.
export async function initiateOnlinePayment(appointment) {
  const gateway = getGateway();
  const { paymentUrl } = await gateway.createCheckout({
    reference: appointment.paymentReference,
    amount: appointment.paymentAmount,
    appointmentId: appointment.id,
  });
  return { paymentUrl, reference: appointment.paymentReference };
}

// تسوية الدفع — تُستدعى من الـ webhook بعد رد البوابة.
// idempotent: إن كانت العملية مدفوعة مسبقًا لا نكرّر شيئًا.
export async function settlePayment(reference, outcome) {
  const appt = await prisma.appointment.findUnique({ where: { paymentReference: reference } });
  if (!appt) throw ApiError.notFound("عملية الدفع غير موجودة");

  if (appt.paymentStatus === "PAID") return appt; // مُسوّاة مسبقًا

  const updated =
    outcome === "success"
      ? // نجاح الدفع => تأكيد الموعد
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { paymentStatus: "PAID", paidAt: new Date(), status: "CONFIRMED" },
        })
      : // فشل الدفع => لا يُثبَّت الموعد نهائيًا (يُلغى ليتحرّر الوقت)
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { paymentStatus: "FAILED", status: "CANCELLED" },
        });

  await logAudit({
    businessId: appt.businessId,
    actorName: "بوابة الدفع",
    action: AUDIT.PAYMENT_STATUS_CHANGED,
    entityType: "Appointment",
    entityId: appt.id,
    meta: { paymentStatus: updated.paymentStatus, by: "gateway", reference },
  });

  if (updated.paymentStatus === "PAID") {
    await recordCustomerPayment(prisma, updated);
  }

  return updated;
}

// يعالج طلب الـ webhook القادم من البوابة (تحقق توقيع -> تسوية).
export async function processWebhook(req) {
  const gateway = getGateway();
  if (!gateway.verifySignature(req)) {
    throw ApiError.unauthorized("توقيع الـ webhook غير صالح");
  }
  const { reference, outcome } = gateway.parseWebhook(req);
  if (!reference) throw ApiError.badRequest("مرجع الدفع مفقود");
  return settlePayment(reference, outcome);
}
