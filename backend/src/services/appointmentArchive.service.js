import { prisma } from "../config/db.js";

const ARCHIVE_AFTER_DAYS = 7;

export async function archiveOldAppointments() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS);

  return prisma.appointment.updateMany({
    where: {
      endAt: { lt: cutoff },
      status: { not: "ARCHIVED" },
    },
    data: { status: "ARCHIVED" },
  });
}

export function startAppointmentArchiver() {
  archiveOldAppointments()
    .then((result) => {
      if (result.count) console.log(`Archived ${result.count} old appointments`);
    })
    .catch((error) => console.error("Failed to archive old appointments:", error));

  const timer = setInterval(() => {
    archiveOldAppointments().catch((error) => console.error("Failed to archive old appointments:", error));
  }, 60 * 60 * 1000);

  return () => clearInterval(timer);
}

