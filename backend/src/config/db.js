import { PrismaClient } from "@prisma/client";

// عميل Prisma واحد مشترك عبر كل التطبيق (singleton) لتفادي استنزاف اتصالات MySQL.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function connectDB() {
  await prisma.$connect();
  console.log("✅ Connected to MySQL via Prisma");
}
