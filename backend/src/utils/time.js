// أدوات وقت بسيطة تتعامل مع "HH:MM" والتواريخ.
// ملاحظة: للتبسيط نعمل بتوقيت الخادم. في الإنتاج يُفضّل التعامل مع timezone المحل
// عبر مكتبة مثل luxon. الفكرة والخوارزمية تبقى نفسها.

// "09:30" -> 570 (دقائق منذ منتصف الليل)
export function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 570 -> "09:30"
export function minutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// يبني Date من تاريخ "YYYY-MM-DD" + دقائق اليوم
export function dateAtMinutes(dateStr, minutes) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// 0=الأحد ... 6=السبت
export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

// تداخل فترتين زمنيتين [aStart,aEnd) و [bStart,bEnd)
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// حدود اليوم كـ Date (بداية ونهاية)
export function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
}
