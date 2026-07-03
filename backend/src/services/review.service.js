import crypto from "crypto";
import { publicAppUrl, sendWhatsappText } from "./whatsapp.service.js";

export function makeReviewToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function ensureAppointmentReviewToken(client, appointmentId) {
  const appointment = await client.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, reviewToken: true },
  });
  if (!appointment) return null;
  if (appointment.reviewToken) return appointment.reviewToken;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const reviewToken = makeReviewToken();
    try {
      const updated = await client.appointment.update({
        where: { id: appointmentId },
        data: { reviewToken },
        select: { reviewToken: true },
      });
      return updated.reviewToken;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  return null;
}

export async function sendAppointmentReviewLink(client, appointmentId, req) {
  const appointment = await client.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      business: { select: { name: true, reviewsEnabled: true } },
      review: { select: { id: true } },
    },
  });
  if (!appointment || !appointment.business.reviewsEnabled || appointment.review) {
    return { sent: false, skipped: true };
  }

  const token = await ensureAppointmentReviewToken(client, appointment.id);
  const url = `${publicAppUrl(req)}/review/${token}`;
  const message = `شكرًا لزيارتك ${appointment.business.name}. يسعدنا تقييم تجربتك من الرابط التالي:\n${url}`;
  const whatsapp = await sendWhatsappText({ to: appointment.customerPhone, message });
  return { token, path: `/review/${token}`, url, whatsapp };
}
