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

export function buildReviewWhatsappUrl(phone, url, customerName = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  const text = [
    customerName ? `مرحبًا ${customerName}` : "مرحبًا",
    "شكرًا لزيارتكم، يسعدنا تقييم تجربتكم معنا من خلال الرابط:",
    url,
  ].join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
