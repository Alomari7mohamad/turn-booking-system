import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = "استعادة كلمة السر - O&H Tech";
  const text = [
    `مرحبا ${name || ""}`.trim(),
    "",
    "وصلنا طلب لاستعادة كلمة السر الخاصة بحسابك.",
    "اضغط على الرابط التالي لتعيين كلمة سر جديدة. الرابط صالح لمدة ساعة واحدة فقط:",
    resetUrl,
    "",
    "إذا لم تطلب استعادة كلمة السر، تجاهل هذه الرسالة.",
  ].join("\n");

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#0f172a">
      <h2 style="color:#064e3b">استعادة كلمة السر</h2>
      <p>مرحبا ${name || ""}</p>
      <p>وصلنا طلب لاستعادة كلمة السر الخاصة بحسابك.</p>
      <p>اضغط على الزر التالي لتعيين كلمة سر جديدة. الرابط صالح لمدة ساعة واحدة فقط.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#064e3b;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">تغيير كلمة السر</a></p>
      <p style="font-size:13px;color:#64748b">إذا لم تطلب استعادة كلمة السر، تجاهل هذه الرسالة.</p>
    </div>
  `;

  if (!hasSmtpConfig()) {
    if (!env.isProd) {
      console.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
      return { sent: false, devResetUrl: resetUrl };
    }
    return { sent: false };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
}
