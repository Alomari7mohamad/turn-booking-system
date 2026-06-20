# 📅 نظام حجز المواعيد والأدوار — Multi-Tenant SaaS

منصّة SaaS متعددة المستأجرين لإدارة حجوزات المواعيد للصالونات والعيادات والمراكز ومحلات الخدمات — شبيهة بـ Calendly / Fresha / Booksy. كل محل يحصل على لوحة تحكم خاصة وبيانات معزولة تمامًا، وصفحة حجز عامة لزبائنه.

## 🧱 التقنيات

| الطبقة | التقنية |
|---|---|
| الواجهة | React 18 + React Router + Vite + CSS خام (RTL) |
| الخادم | Node.js + Express |
| قاعدة البيانات | Prisma ORM — **SQLite** للتطوير، **MySQL** للإنتاج |
| المصادقة | JWT (Bearer Token) |
| المعمارية | Multi-Tenant (Shared Database / Shared Schema) |

> **ملاحظة عن قاعدة البيانات:** المشروع يعمل افتراضيًا على **SQLite** (لا يحتاج تثبيت أي شيء، يبدأ فورًا). الـ schema مكتوب بصيغة محايدة للمزوّد، والتبديل إلى **MySQL** هو تغيير سطرين فقط (انظر [التبديل إلى MySQL](#-التبديل-إلى-mysql)).

---

## 🚀 التشغيل السريع

المتطلبات: **Node.js 18+** فقط.

### 1) الخادم (Backend)
```bash
cd backend
npm install
npx prisma generate      # توليد عميل Prisma
npx prisma db push       # إنشاء قاعدة البيانات والجداول
npm run seed             # تعبئة بيانات تجريبية
npm run dev              # تشغيل الخادم على http://localhost:4000
```

### 2) الواجهة (Frontend) — في نافذة طرفية أخرى
```bash
cd frontend
npm install
npm run dev              # تشغيل الواجهة على http://localhost:5173
```

ثم افتح المتصفح على **http://localhost:5173**

---

## 🔑 حسابات تجريبية (بعد `npm run seed`)

| الدور | البريد | كلمة المرور |
|---|---|---|
| المدير العام (SUPER_ADMIN) | `admin@booking.com` | `admin123` |
| صاحب صالون (BUSINESS_OWNER) | `owner@salon.com` | `owner123` |
| موظفة (STAFF) | `staff@salon.com` | `staff123` |
| صاحب عيادة (BUSINESS_OWNER) | `owner@clinic.com` | `owner123` |

**صفحات الحجز العامة** (بدون تسجيل دخول):
- http://localhost:5173/book/lamset-aljamal — صالون (الدفع الإلكتروني + الدفع في المحل مفعّلان)
- http://localhost:5173/book/smile-dental — عيادة (الدفع في المحل فقط)
- http://localhost:5173/book/expired-center — مركز **باشتراك منتهٍ** (لتجربة منع الحجز)

---

## 👥 الأدوار والصلاحيات

- **SUPER_ADMIN** — يدير المنصّة بالكامل: إضافة/تعديل/تفعيل/إيقاف المحلات، تحديد الاشتراك (شهري/سنوي)، إدارة أصحاب المحلات، رؤية إحصائيات كل محل.
- **BUSINESS_OWNER** — لوحة تحكم محلّه: تعديل بياناته، إدارة الموظفين والخدمات وساعات العمل والأوقات المغلقة، عرض وتعديل وإلغاء الحجوزات.
- **STAFF** — يرى مواعيده فقط ويحدّث حالتها.
- **CUSTOMER** — يحجز من الصفحة العامة بدون تسجيل دخول.

---

## 🔒 عزل بيانات المحلات (Multi-Tenancy)

العزل مفروض على **طبقتين**:
1. **JWT** يحمل `businessId` و`role`.
2. **Middleware** (`middleware/tenant.js`) يحقن `req.tenantId`، وكل استعلام خاص بمحل مقيّد بـ `where: { businessId: req.tenantId }`. لا يستطيع صاحب محل رؤية بيانات محل آخر إطلاقًا.

`SUPER_ADMIN` هو المستخدم الوحيد بدون `businessId`، ويُسمح له بتجاوز الفلتر في مسارات الإدارة فقط.

---

## 🧠 محرّك الأوقات المتاحة

في `backend/src/services/availability.service.js`. يحسب الفتحات المتاحة عبر:
1. مدة الخدمة (`durationMinutes`).
2. دوام اليوم (دوام الموظف إن وُجد، وإلا دوام المحل).
3. توليد فتحات متتالية داخل نافذة الدوام.
4. استبعاد الفتحات المتداخلة مع: الحجوزات الحالية، الأوقات المغلقة، والماضي.

**منع الحجز المكرّر:** يتم فحص التداخل `(start < existingEnd AND end > existingStart)` داخل **transaction** قبل الإدراج، مع قيد فريد `@@unique([employeeId, startAt])` كشبكة أمان على مستوى قاعدة البيانات.

---

## 💳 نظام الدفع المرن

كل صاحب محل يتحكّم من **إعدادات المحل ← إعدادات الدفع** بتفعيل/تعطيل طريقتي الدفع:

| الطريقة | السلوك |
|---|---|
| **الدفع في المحل** (`PAY_AT_STORE`) | يُؤكَّد الحجز مباشرة، `paymentStatus = PENDING` حتى يدفع الزبون عند الحضور |
| **الدفع الإلكتروني** (`ONLINE`) | يُنشأ الحجز كـ `PENDING` ويُوجَّه الزبون لبوابة الدفع. عند النجاح → `PAID` + تأكيد الحجز. عند الفشل → `FAILED` + إلغاء (يتحرّر الوقت) |

**المنطق في صفحة الحجز العامة:**
- تظهر فقط الطرق المفعّلة لدى المحل.
- طريقة واحدة مفعّلة ⇒ تُختار تلقائيًا.
- الطريقتان مفعّلتان ⇒ يجب على الزبون الاختيار.
- لا توجد طريقة مفعّلة ⇒ يُمنع الحجز برسالة واضحة.

**معمارية الدفع (قابلة لتبديل البوابة):**
- كل منطق البوابة معزول في `services/paymentService.js` + `services/gateways/`.
- البوابة الحالية `mock` (محاكاة محلية). لإضافة بوابة حقيقية: أنشئ `gateways/<name>.gateway.js` يطبّق `createCheckout` / `parseWebhook` / `verifySignature`، وسجّله في `paymentService.js`، ثم غيّر `PAYMENT_PROVIDER` في `.env`.
- **لا تُخزَّن أي بيانات بطاقات** — الدفع يتم بالكامل لدى البوابة الخارجية.
- **Webhook**: `POST /api/payments/webhook` يستقبل نتيجة الدفع (idempotent — آمن للاستدعاء المتكرر).
- صفحتا نتيجة: `/pay/success` و `/pay/failed`.

**صلاحيات تغيير حالة الدفع يدويًا:**
- `BUSINESS_OWNER` ← فقط لحجوزات **الدفع في المحل**.
- `SUPER_ADMIN` ← أي حجز (بما فيه الإلكتروني).

**مسارات الدفع:**
```
POST /api/payments/webhook                      استقبال نتيجة الدفع (من البوابة)
GET  /api/payments/:reference                   ملخّص عملية الدفع (لصفحة الدفع)
POST /api/payments/mock/:reference/complete     محاكاة رد البوابة (mock فقط)
PATCH /api/business/appointments/:id/payment    تغيير حالة الدفع (الدفع في المحل فقط)
PATCH /api/admin/appointments/:id/payment       تغيير أي حالة دفع (SUPER_ADMIN)
```

---

## 🗂️ هيكل المشروع

```
backend/
  prisma/
    schema.prisma          # تعريف الجداول (9 جداول + علاقات)
    seed.js                # بيانات تجريبية
  src/
    config/                # env, db (عميل Prisma)
    middleware/            # auth (JWT), authorize (أدوار), tenant (عزل), error
    services/              # availability.service (محرّك الأوقات + الحجز الآمن)
    controllers/           # auth, admin, business, staff, public
    routes/                # نفس التقسيم + index
    utils/                 # jwt, password, time, ApiError, asyncHandler
    app.js
  server.js
frontend/
  src/
    api/                   # عميل axios + تجميع نداءات الـ API
    context/               # AuthContext (إدارة الجلسة)
    layouts/               # DashboardLayout (sidebar + topbar)
    components/            # ui (أزرار/حقول/شارات...), Modal, Toast, ConfirmDialog, ProtectedRoute
    pages/                 # 12 صفحة (انظر أدناه)
    styles/                # theme.css (نظام التصميم) + layout.css
```

### الصفحات
Login · SuperAdminDashboard · BusinessesManagement · BusinessDashboard · AppointmentsPage · ServicesManagement · EmployeesManagement · WorkingHoursSettings · SubscriptionPage · BusinessSettings · StaffDashboard · PublicBooking (`/book/:slug`)

---

## 🔌 ملخّص الـ API

```
POST   /api/auth/login                          تسجيل الدخول
GET    /api/auth/me                             المستخدم الحالي

# SUPER_ADMIN
GET    /api/admin/stats                         إحصائيات عامة
GET    /api/admin/businesses                    قائمة المحلات
POST   /api/admin/businesses                    إنشاء محل + صاحبه + اشتراك
PATCH  /api/admin/businesses/:id                تعديل محل
PATCH  /api/admin/businesses/:id/status         تفعيل/إيقاف
PATCH  /api/admin/businesses/:id/subscription   تحديد الاشتراك
PATCH  /api/admin/businesses/:id/owner          إدارة صاحب المحل

# BUSINESS_OWNER  (كلها معزولة بـ tenantId)
GET    /api/business/me | PATCH /api/business/me
GET    /api/business/dashboard
CRUD   /api/business/employees
CRUD   /api/business/services
GET|PUT /api/business/working-hours
CRUD   /api/business/blocked-times
GET    /api/business/appointments | PATCH :id | DELETE :id

# STAFF
GET    /api/staff/appointments                  مواعيده فقط
PATCH  /api/staff/appointments/:id/status

# PUBLIC (بدون مصادقة)
GET    /api/public/:slug                        المحل + الخدمات + الموظفون
GET    /api/public/:slug/availability           الأوقات المتاحة
POST   /api/public/:slug/appointments           إنشاء حجز
```

---

## 🐬 التبديل إلى MySQL

1. شغّل خادم MySQL وأنشئ قاعدة بيانات (أو دع Prisma ينشئها).
2. في `backend/prisma/schema.prisma` غيّر:
   ```prisma
   datasource db {
     provider = "mysql"        // كان "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. في `backend/.env`:
   ```
   DATABASE_URL="mysql://root:كلمة_المرور@localhost:3306/turn_booking"
   ```
4. أعد التوليد والدفع:
   ```bash
   npx prisma generate && npx prisma db push && npm run seed
   ```

> الـ schema محايد (لا enums ولا أنواع أصلية خاصة بمزوّد)، فالانتقال سلس. القيم النصية ذات الدلالة (الأدوار/الحالات) موثّقة أعلى ملف `schema.prisma`.

---

## ✅ التحقّق من المدخلات (Validations)

يفرض الـ Backend هذه القواعد على الحجز العام (رسائل عربية واضحة تظهر للمستخدم):
- الاسم مطلوب · رقم الهاتف مطلوب (٦–٢٠ خانة) · البريد (إن وُجد) يجب أن يكون صالحًا
- الخدمة مطلوبة · الموظف اختياري (أو "أي موظف متاح")
- التاريخ والوقت مطلوبان ولا يمكن أن يكونا في الماضي
- **لا يمكن الحجز في وقت مغلق** (BlockedTime)
- **لا يمكن الحجز خارج ساعات العمل** (دوام الموظف أو دوام المحل)
- **لا يمكن الحجز إذا انتهى اشتراك المحل**
- منع الحجز/إعادة الجدولة المتعارضة لنفس الموظف (داخل transaction)

## 📋 سجلّ التدقيق (Audit Log)

تُسجَّل الأحداث المهمة في جدول `audit_logs` ويراها صاحب المحل في **سجلّ النشاط**:
إنشاء/إلغاء/تعديل حجز · تغيير حالة الدفع (يدوي أو من البوابة) · تغيير إعدادات الدفع · تغيير أوقات الدوام.

## 🧾 صفحة تأكيد الحجز (Booking Confirmation)

تظهر بعد كل حجز ناجح (دفع في المحل) وبعد نجاح الدفع الإلكتروني، وتعرض:
رقم الحجز · اسم المحل · الخدمة · الموظف · التاريخ والوقت · المبلغ · طريقة الدفع · حالة الدفع.

## 🧪 الاختبارات (QA)

اختبارات API أساسية باستخدام مشغّل الاختبارات المدمج في Node (تغطّي: الحجز، الدفع، الصلاحيات، عزل المحلات).

```bash
# 1) تأكد أن الخادم يعمل (npm run dev) ويفضّل تشغيل seed نظيف
npm run seed
# 2) في طرفية أخرى داخل backend:
npm test
```

> الاختبارات تعمل مقابل الخادم الحيّ على `http://localhost:4000` (عدّل `TEST_BASE` لتغيير العنوان).

## 🎬 سيناريوهات اختبار الدفع يدويًا

**أ) الدفع في المحل:** افتح `/book/lamset-aljamal` → اختر خدمة وموظفًا ووقتًا → في خطوة البيانات اختر **"دفع في المحل"** → تأكيد ⇒ يظهر تأكيد الحجز فورًا (الحالة `CONFIRMED`، الدفع `PENDING`). يستطيع صاحب المحل لاحقًا تعليمه **مدفوعًا** من لوحة الحجوزات.

**ب) الدفع الإلكتروني (نجاح):** نفس الخطوات لكن اختر **"دفع إلكتروني"** → "المتابعة للدفع" → في بوابة المحاكاة اضغط **"ادفع الآن"** ⇒ تتحوّل للحالة `PAID` ويُؤكَّد الحجز وتظهر صفحة النجاح بتفاصيل الحجز.

**ج) الدفع الإلكتروني (فشل):** في بوابة المحاكاة اضغط **"محاكاة فشل الدفع"** ⇒ الحالة `FAILED` ولا يُثبَّت الموعد (يتحرّر الوقت تلقائيًا) وتظهر صفحة الفشل.

**د) طريقة واحدة فقط:** افتح `/book/smile-dental` (الدفع في المحل فقط) ⇒ تُختار الطريقة تلقائيًا دون مطالبة الزبون.

**هـ) اشتراك منتهٍ:** افتح `/book/expired-center` وحاول الحجز ⇒ يُرفض برسالة واضحة.

**و) صلاحيات تغيير حالة الدفع:** صاحب المحل يغيّر حالة دفع **الدفع في المحل** فقط؛ محاولة تعديل دفع إلكتروني تُرفض، بينما يستطيع `SUPER_ADMIN` تعديل أي حالة.

## 📈 قابلية التوسّع

- **Shared Schema + businessId** يدعم آلاف المحلات دون إعادة بناء.
- فهارس على `businessId` و`startAt` في الجداول الكثيفة.
- عميل Prisma واحد (singleton) لإدارة اتصالات قاعدة البيانات.
- طبقات منفصلة (routes / controllers / services) تسهّل إضافة الميزات (دفع إلكتروني، إشعارات SMS/Email، تقارير...).

## 🧪 ما تم اختباره
تم التحقق فعليًا من: تسجيل الدخول، عزل البيانات بين المحلات، منع الوصول حسب الدور (403)، إحصائيات الأدمن، صفحة الحجز العامة، محرّك الأوقات المتاحة، إنشاء حجز، ومنع الحجز المكرّر (409).

**نظام الدفع:** تم التحقق من إعدادات الدفع لكل محل، اختيار الطريقة في صفحة الحجز (تلقائي/إجباري/ممنوع)، الدفع في المحل (تأكيد مباشر)، الدفع الإلكتروني عبر البوابة الوهمية (نجاح ⇒ PAID وتأكيد، فشل ⇒ FAILED وتحرير الوقت)، الـ webhook، وصلاحيات تغيير حالة الدفع يدويًا (صاحب المحل للدفع في المحل فقط، والإلكتروني للـ SUPER_ADMIN فقط).
