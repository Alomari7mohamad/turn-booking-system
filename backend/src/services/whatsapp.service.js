export function normalizeWhatsappPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function publicAppUrl(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const origin = req?.get?.("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:5173";
}

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsappText({ to, message }) {
  const phone = normalizeWhatsappPhone(to);
  if (!phone || phone.length < 8) return { sent: false, reason: "INVALID_PHONE" };
  if (!whatsappConfigured()) return { sent: false, reason: "WHATSAPP_NOT_CONFIGURED" };

  const version = process.env.WHATSAPP_API_VERSION || "v20.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { preview_url: true, body: message },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { sent: false, reason: "WHATSAPP_API_ERROR", details: payload };
  }
  return { sent: true, payload };
}
