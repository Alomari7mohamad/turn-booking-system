import { createApp } from "./src/app.js";
import { connectDB, prisma } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import { startAppointmentArchiver } from "./src/services/appointmentArchive.service.js";

async function start() {
  try {
    await connectDB();
    const app = createApp();
    const stopAppointmentArchiver = startAppointmentArchiver();
    const server = app.listen(env.port, () => {
      console.log(`🚀 API running on http://localhost:${env.port}/api`);
    });

    const shutdown = async () => {
      console.log("\n⏏️  Shutting down...");
      stopAppointmentArchiver();
      await prisma.$disconnect();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
