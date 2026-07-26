export const REJECTION_MARKER = "[REJECTED_BY_BUSINESS]";

export function markAppointmentRejected(notes) {
  const current = String(notes || "").trim();
  if (current.includes(REJECTION_MARKER)) return current;
  return [current, REJECTION_MARKER].filter(Boolean).join("\n");
}

export function isAppointmentRejected(appointment) {
  return appointment?.status === "CANCELLED"
    && String(appointment?.notes || "").includes(REJECTION_MARKER);
}
