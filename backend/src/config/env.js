import dotenv from "dotenv";
dotenv.config();

function required(key, fallback) {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: required("JWT_SECRET", "dev-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  isProd: (process.env.NODE_ENV || "development") === "production",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@oh-tech.co",

  // الدفع: اسم البوابة المستخدمة (mock افتراضيًا) + سر التحقق من الـ webhook
  paymentProvider: process.env.PAYMENT_PROVIDER || "mock",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || "dev-webhook-secret",
  disablePhoneVerification: process.env.DISABLE_PHONE_VERIFICATION !== "false",
};
