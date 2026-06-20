import { Router } from "express";
import { webhook, getPaymentInfo, mockComplete } from "../controllers/payment.controller.js";

// مسارات الدفع العامة (بدون مصادقة). البوابة الخارجية تستدعي /webhook.
const router = Router();

router.post("/webhook", webhook);
router.get("/:reference", getPaymentInfo);
router.post("/mock/:reference/complete", mockComplete); // محاكاة فقط

export default router;
