import { prisma } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { processWebhook, settlePayment } from "../services/paymentService.js";

// POST /api/payments/webhook
// نقطة استقبال نتيجة الدفع من بوابة الدفع (في الإنتاج تستدعيها البوابة مباشرة).
export const webhook = asyncHandler(async (req, res) => {
  const appointment = await processWebhook(req);
  res.json({ success: true, status: appointment.paymentStatus });
});

// GET /api/payments/:reference
// تُستخدم من صفحة الدفع لعرض ملخّص العملية (المبلغ/المحل/الخدمة).
export const getPaymentInfo = asyncHandler(async (req, res) => {
  const appt = await prisma.appointment.findUnique({
    where: { paymentReference: req.params.reference },
    include: {
      service: { select: { name: true } },
      employee: { select: { name: true } },
      business: { select: { name: true, slug: true } },
    },
  });
  if (!appt) throw ApiError.notFound("عملية الدفع غير موجودة");

  res.json({
    success: true,
    payment: {
      reference: appt.paymentReference,
      bookingNumber: appt.id,
      amount: appt.paymentAmount,
      status: appt.paymentStatus,
      paymentMethod: appt.paymentMethod,
      service: appt.service?.name,
      employee: appt.employee?.name,
      business: appt.business?.name,
      slug: appt.business?.slug,
      startAt: appt.startAt,
      endAt: appt.endAt,
    },
  });
});

// POST /api/payments/mock/:reference/complete  { outcome: 'success' | 'fail' }
// خاصّ ببوابة المحاكاة فقط: صفحة الدفع الوهمية تستدعيه ليحاكي رد البوابة الحقيقي.
// في الإنتاج يُحذف هذا المسار وتتولّى البوابة استدعاء /webhook.
export const mockComplete = asyncHandler(async (req, res) => {
  const { reference } = req.params;
  const outcome = req.body?.outcome === "success" ? "success" : "fail";
  const appointment = await settlePayment(reference, outcome);
  res.json({ success: true, status: appointment.paymentStatus });
});
