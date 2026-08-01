export function publicBaseUrl() {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return window.location.origin;
}

export function buildReviewUrl(pathOrToken) {
  const path = String(pathOrToken || "").startsWith("/review/")
    ? pathOrToken
    : `/review/${pathOrToken}`;
  return `${publicBaseUrl()}${path}`;
}

export function buildWhatsappMessageUrl(phone, message) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildReviewWhatsappUrl(phone, url, customerName = "") {
  const text = [
    customerName ? `مرحبا ${customerName}` : "مرحبا",
    "شكرا لزيارتكم، يسعدنا تقييم تجربتكم معنا من خلال الرابط:",
    url,
  ].join("\n");
  return buildWhatsappMessageUrl(phone, text);
}

