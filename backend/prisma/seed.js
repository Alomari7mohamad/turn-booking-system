import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (p) => bcrypt.hash(p, 10);

async function main() {
  console.log("🌱 Seeding...");

  // تنظيف (بالترتيب الصحيح لتجنّب قيود المفاتيح الأجنبية)
  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedTime.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  // ===== Super Admin =====
  await prisma.user.create({
    data: {
      name: "المدير العام",
      email: "admin@booking.com",
      passwordHash: await hash("admin123"),
      role: "SUPER_ADMIN",
      businessId: null,
    },
  });

  // دالة مساعدة لإنشاء دوام الأحد-الخميس
  const weekDefaults = (businessId) => [
    ...[0, 1, 2, 3, 4].map((dayOfWeek) => ({
      businessId,
      dayOfWeek,
      startTime: "09:00",
      endTime: "18:00",
      isClosed: false,
    })),
    { businessId, dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isClosed: true },
    { businessId, dayOfWeek: 6, startTime: "10:00", endTime: "16:00", isClosed: false },
  ];

  // ===== المحل 1: صالون =====
  const salon = await prisma.business.create({
    data: {
      name: "صالون لمسة الجمال",
      slug: "lamset-aljamal",
      email: "salon@booking.com",
      phone: "0501234567",
      address: "الرياض - حي النخيل",
      timezone: "Asia/Riyadh",
      onlinePaymentEnabled: true, // الصالون: الطريقتان مفعّلتان
      payAtStoreEnabled: true,
    },
  });

  await prisma.user.create({
    data: {
      businessId: salon.id,
      name: "نورة العتيبي",
      email: "owner@salon.com",
      passwordHash: await hash("owner123"),
      role: "BUSINESS_OWNER",
    },
  });

  await prisma.subscription.create({
    data: {
      businessId: salon.id,
      plan: "MONTHLY",
      price: 199,
      endsAt: new Date(Date.now() + 30 * 86400000),
    },
  });

  await prisma.workingHours.createMany({ data: weekDefaults(salon.id) });

  const [haircut, color, makeup] = await Promise.all([
    prisma.service.create({
      data: { businessId: salon.id, name: "قص شعر", durationMinutes: 30, price: 50 },
    }),
    prisma.service.create({
      data: { businessId: salon.id, name: "صبغة شعر", durationMinutes: 90, price: 200 },
    }),
    prisma.service.create({
      data: { businessId: salon.id, name: "مكياج", durationMinutes: 60, price: 150 },
    }),
  ]);

  // موظفة لديها حساب دخول STAFF
  const staffUser = await prisma.user.create({
    data: {
      businessId: salon.id,
      name: "سارة محمد",
      email: "staff@salon.com",
      passwordHash: await hash("staff123"),
      role: "STAFF",
    },
  });
  const emp1 = await prisma.employee.create({
    data: { businessId: salon.id, name: "سارة محمد", title: "خبيرة تجميل", userId: staffUser.id },
  });
  const emp2 = await prisma.employee.create({
    data: { businessId: salon.id, name: "ريم خالد", title: "مصففة شعر" },
  });

  await prisma.employeeService.createMany({
    data: [
      { employeeId: emp1.id, serviceId: haircut.id },
      { employeeId: emp1.id, serviceId: makeup.id },
      { employeeId: emp2.id, serviceId: haircut.id },
      { employeeId: emp2.id, serviceId: color.id },
    ],
  });

  // حجز تجريبي غدًا الساعة 11:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);
  await prisma.appointment.create({
    data: {
      businessId: salon.id,
      serviceId: haircut.id,
      employeeId: emp1.id,
      customerName: "هند الزهراني",
      customerPhone: "0559876543",
      startAt: tomorrow,
      endAt: new Date(tomorrow.getTime() + 30 * 60000),
      status: "CONFIRMED",
      paymentMethod: "PAY_AT_STORE",
      paymentStatus: "PAID",
      paymentAmount: 50,
      paidAt: new Date(),
    },
  });

  // ===== المحل 2: عيادة =====
  const clinic = await prisma.business.create({
    data: {
      name: "عيادة الابتسامة لطب الأسنان",
      slug: "smile-dental",
      email: "clinic@booking.com",
      phone: "0533334444",
      address: "جدة - حي الروضة",
      timezone: "Asia/Riyadh",
      onlinePaymentEnabled: false, // العيادة: الدفع في المحل فقط
      payAtStoreEnabled: true,
    },
  });

  await prisma.user.create({
    data: {
      businessId: clinic.id,
      name: "د. أحمد الشهري",
      email: "owner@clinic.com",
      passwordHash: await hash("owner123"),
      role: "BUSINESS_OWNER",
    },
  });

  await prisma.subscription.create({
    data: {
      businessId: clinic.id,
      plan: "YEARLY",
      price: 1999,
      endsAt: new Date(Date.now() + 365 * 86400000),
    },
  });

  await prisma.workingHours.createMany({ data: weekDefaults(clinic.id) });

  const [checkup, cleaning] = await Promise.all([
    prisma.service.create({
      data: { businessId: clinic.id, name: "كشف وتشخيص", durationMinutes: 30, price: 100 },
    }),
    prisma.service.create({
      data: { businessId: clinic.id, name: "تنظيف أسنان", durationMinutes: 45, price: 250 },
    }),
  ]);

  const doc = await prisma.employee.create({
    data: { businessId: clinic.id, name: "د. أحمد الشهري", title: "أخصائي أسنان" },
  });
  await prisma.employeeService.createMany({
    data: [
      { employeeId: doc.id, serviceId: checkup.id },
      { employeeId: doc.id, serviceId: cleaning.id },
    ],
  });

  // ===== المحل 3: اشتراك منتهٍ (لاختبار منع الحجز) =====
  const expired = await prisma.business.create({
    data: {
      name: "مركز تجريبي (اشتراك منتهٍ)",
      slug: "expired-center",
      phone: "0500000000",
      timezone: "Asia/Riyadh",
      payAtStoreEnabled: true,
    },
  });
  await prisma.subscription.create({
    data: {
      businessId: expired.id,
      plan: "MONTHLY",
      price: 199,
      status: "EXPIRED",
      startsAt: new Date(Date.now() - 60 * 86400000),
      endsAt: new Date(Date.now() - 5 * 86400000), // انتهى قبل 5 أيام
    },
  });
  await prisma.workingHours.createMany({ data: weekDefaults(expired.id) });
  const expSvc = await prisma.service.create({
    data: { businessId: expired.id, name: "خدمة تجريبية", durationMinutes: 30, price: 30 },
  });
  const expEmp = await prisma.employee.create({
    data: { businessId: expired.id, name: "موظف تجريبي" },
  });
  await prisma.employeeService.create({
    data: { employeeId: expEmp.id, serviceId: expSvc.id },
  });

  console.log("✅ Seed done.\n");
  console.log("بيانات الدخول التجريبية:");
  console.log("  SUPER_ADMIN     -> admin@booking.com / admin123");
  console.log("  صاحب الصالون     -> owner@salon.com  / owner123");
  console.log("  موظفة الصالون    -> staff@salon.com  / staff123");
  console.log("  صاحب العيادة     -> owner@clinic.com / owner123");
  console.log("\nروابط الحجز العامة:");
  console.log("  /book/lamset-aljamal");
  console.log("  /book/smile-dental");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
