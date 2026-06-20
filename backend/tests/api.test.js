// اختبارات API أساسية — تعمل مقابل الخادم الفعلي على localhost:4000.
// التشغيل: 1) شغّل الخادم (npm run dev)  2) في طرفية أخرى: npm test
// يُفضّل تشغيل `npm run seed` قبلها للحصول على حالة نظيفة.
import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE || "http://localhost:4000/api";

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const login = async (email, password) => {
  const r = await api("POST", "/auth/login", { body: { email, password } });
  return r.json?.token;
};

// يجد تاريخًا مستقبليًا (غير الجمعة) فيه فتحات متاحة للخدمة/الموظف.
async function findOpenSlot(slug, serviceId, employeeId) {
  for (let d = 1; d <= 10; d++) {
    const date = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    const r = await api("GET", `/public/${slug}/availability?serviceId=${serviceId}&employeeId=${employeeId}&date=${date}`);
    if (r.json?.slots?.length >= 2) return { date, slots: r.json.slots };
  }
  throw new Error("لم يتم العثور على فتحات متاحة للاختبار");
}

let tokens = {};
let salon = {}; // { slug, serviceId, employeeId }

before(async () => {
  // تأكد أن الخادم يعمل
  const health = await api("GET", "/health").catch(() => ({ status: 0 }));
  assert.equal(health.status, 200, "الخادم غير مشغّل على " + BASE);

  tokens.admin = await login("admin@booking.com", "admin123");
  tokens.salonOwner = await login("owner@salon.com", "owner123");
  tokens.clinicOwner = await login("owner@clinic.com", "owner123");
  tokens.staff = await login("staff@salon.com", "staff123");

  const info = await api("GET", "/public/lamset-aljamal");
  const svc = info.json.services[0];
  const emp = info.json.employees.find((e) => e.serviceIds.includes(svc.id));
  salon = { slug: "lamset-aljamal", serviceId: svc.id, employeeId: emp.id };
});

// ============ المصادقة ============
test("تسجيل الدخول يعيد توكنًا لكل دور", () => {
  assert.ok(tokens.admin, "admin");
  assert.ok(tokens.salonOwner, "salon owner");
  assert.ok(tokens.staff, "staff");
});

test("تسجيل دخول ببيانات خاطئة يُرفض", async () => {
  const r = await api("POST", "/auth/login", { body: { email: "owner@salon.com", password: "wrong" } });
  assert.equal(r.status, 401);
});

// ============ الصلاحيات ============
test("صاحب المحل لا يصل لمسارات الأدمن (403)", async () => {
  const r = await api("GET", "/admin/stats", { token: tokens.salonOwner });
  assert.equal(r.status, 403);
});

test("بدون توكن لا وصول لمسارات المحل (401)", async () => {
  const r = await api("GET", "/business/services");
  assert.equal(r.status, 401);
});

test("الموظف لا يصل لإدارة الخدمات (403)", async () => {
  const r = await api("GET", "/business/services", { token: tokens.staff });
  assert.equal(r.status, 403);
});

// ============ عزل بيانات المحلات ============
test("عزل tenant: خدمات صاحب المحل تخص محلّه فقط", async () => {
  const salonRes = await api("GET", "/business/services", { token: tokens.salonOwner });
  const clinicRes = await api("GET", "/business/services", { token: tokens.clinicOwner });
  const salonBizIds = new Set(salonRes.json.services.map((s) => s.businessId));
  const clinicBizIds = new Set(clinicRes.json.services.map((s) => s.businessId));
  assert.equal(salonBizIds.size, 1, "كل خدمات الصالون لنفس المحل");
  assert.equal(clinicBizIds.size, 1, "كل خدمات العيادة لنفس المحل");
  const [salonBiz] = [...salonBizIds];
  const [clinicBiz] = [...clinicBizIds];
  assert.notEqual(salonBiz, clinicBiz, "محلّان مختلفان");
});

// ============ الحجز ============
test("حجز صحيح (دفع في المحل) يُؤكَّد مباشرة", async () => {
  const { slots } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const r = await api("POST", `/public/${salon.slug}/appointments`, {
    body: { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: slots[0].startAt, customerName: "اختبار آلي", customerPhone: "0500000001", paymentMethod: "PAY_AT_STORE" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.appointment.status, "CONFIRMED");
  assert.equal(r.json.appointment.paymentStatus, "PENDING");
});

test("منع الحجز المكرّر لنفس الموظف/الوقت (409)", async () => {
  const { slots } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const slot = slots[slots.length - 1]; // فتحة أخيرة لتقليل التعارض مع اختبارات أخرى
  const body = { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: slot.startAt, customerName: "أول", customerPhone: "0500000002", paymentMethod: "PAY_AT_STORE" };
  const first = await api("POST", `/public/${salon.slug}/appointments`, { body });
  assert.equal(first.status, 201);
  const second = await api("POST", `/public/${salon.slug}/appointments`, { body: { ...body, customerName: "ثانٍ" } });
  assert.equal(second.status, 409);
});

test("التحقق: الاسم مطلوب", async () => {
  const { slots } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const r = await api("POST", `/public/${salon.slug}/appointments`, {
    body: { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: slots[0].startAt, customerPhone: "0500000003", paymentMethod: "PAY_AT_STORE" },
  });
  assert.equal(r.status, 400);
});

test("منع الحجز خارج ساعات العمل (03:00)", async () => {
  const { date } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const r = await api("POST", `/public/${salon.slug}/appointments`, {
    body: { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: `${date}T03:00:00`, customerName: "خارج الدوام", customerPhone: "0500000004", paymentMethod: "PAY_AT_STORE" },
  });
  assert.equal(r.status, 400);
});

test("منع الحجز إذا انتهى اشتراك المحل", async () => {
  const info = await api("GET", "/public/expired-center");
  const svc = info.json.services[0];
  const emp = info.json.employees[0];
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const r = await api("POST", `/public/expired-center/appointments`, {
    body: { serviceId: svc.id, employeeId: emp.id, startAt: `${date}T11:00:00`, customerName: "اشتراك منتهٍ", customerPhone: "0500000005", paymentMethod: "PAY_AT_STORE" },
  });
  assert.equal(r.status, 403);
});

// ============ الدفع ============
test("الدفع الإلكتروني: يتطلّب توجيهًا للبوابة ثم يُسوّى بنجاح", async () => {
  const { slots } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const slot = slots[Math.floor(slots.length / 2)];
  const book = await api("POST", `/public/${salon.slug}/appointments`, {
    body: { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: slot.startAt, customerName: "دفع إلكتروني", customerPhone: "0500000006", paymentMethod: "ONLINE" },
  });
  assert.equal(book.status, 201);
  assert.equal(book.json.requiresPayment, true);
  const ref = book.json.reference;
  assert.ok(ref, "يوجد مرجع دفع");

  // محاكاة نجاح الدفع
  const settle = await api("POST", `/payments/mock/${ref}/complete`, { body: { outcome: "success" } });
  assert.equal(settle.status, 200);

  const info = await api("GET", `/payments/${ref}`);
  assert.equal(info.json.payment.status, "PAID");
});

test("صاحب المحل لا يعدّل حالة الدفع الإلكتروني يدويًا (403)", async () => {
  // ننشئ حجز دفع إلكتروني
  const { slots } = await findOpenSlot(salon.slug, salon.serviceId, salon.employeeId);
  const slot = slots[slots.length - 2];
  const book = await api("POST", `/public/${salon.slug}/appointments`, {
    body: { serviceId: salon.serviceId, employeeId: salon.employeeId, startAt: slot.startAt, customerName: "اونلاين", customerPhone: "0500000007", paymentMethod: "ONLINE" },
  });
  const apptId = book.json.appointment.id;
  const r = await api("PATCH", `/business/appointments/${apptId}/payment`, { token: tokens.salonOwner, body: { paymentStatus: "PAID" } });
  assert.equal(r.status, 403);

  // لكن SUPER_ADMIN يستطيع
  const adminR = await api("PATCH", `/admin/appointments/${apptId}/payment`, { token: tokens.admin, body: { paymentStatus: "REFUNDED" } });
  assert.equal(adminR.status, 200);
  assert.equal(adminR.json.appointment.paymentStatus, "REFUNDED");
});
