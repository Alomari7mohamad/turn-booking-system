import { env } from "../../config/env.js";

// ============================================================
// بوابة دفع وهمية (Mock) للتجربة المحلية دون مزوّد حقيقي.
// كل بوابة حقيقية (Stripe/PayTabs/Moyasar...) يجب أن تطبّق نفس الواجهة:
//   createCheckout(...) -> { paymentUrl }
//   parseWebhook(req)   -> { reference, outcome }
//   verifySignature(req)-> boolean
// وبهذا يصبح تبديل البوابة مجرّد إضافة ملف جديد وتغيير PAYMENT_PROVIDER.
// ============================================================
export const mockGateway = {
  name: "mock",

  // ينشئ "جلسة دفع" ويعيد رابط صفحة الدفع.
  // في المحاكاة: نوجّه الزبون لصفحة أمامية محلية تحاكي البوابة (/pay/:reference).
  async createCheckout({ reference }) {
    return { paymentUrl: `${env.clientUrl}/pay/${reference}` };
  },

  // يستخرج نتيجة الدفع من جسم الـ webhook.
  // في المحاكاة: الجسم يحوي { reference, outcome }.
  parseWebhook(req) {
    const { reference, outcome } = req.body || {};
    return { reference, outcome: outcome === "success" ? "success" : "fail" };
  },

  // التحقق من توقيع البوابة. المحاكاة لا توقّع فعليًا (تتحقق من سر بسيط إن وُجد).
  verifySignature(req) {
    const sig = req.headers["x-webhook-secret"];
    // أثناء التطوير نقبل الطلبات حتى بدون توقيع لتسهيل التجربة.
    return !sig || sig === env.paymentWebhookSecret;
  },
};
