function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "").trim();
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function parseDateOfBirth(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function customerHubEnabled(client, businessId) {
  const business = await client.business.findUnique({
    where: { id: businessId },
    select: { customerHubEnabled: true },
  });
  return Boolean(business?.customerHubEnabled);
}

export async function recordCustomerBooking(client, appointment, profile = {}) {
  const phone = normalizePhone(appointment.customerPhone);
  if (!phone) return null;
  if (!(await customerHubEnabled(client, appointment.businessId))) return null;

  const visitDate = appointment.startAt ? new Date(appointment.startAt) : new Date();
  const { start, end } = monthBounds(new Date());
  const isCurrentMonth = visitDate >= start && visitDate < end;
  const dateOfBirth = parseDateOfBirth(profile.dateOfBirth);

  return client.customer.upsert({
    where: { businessId_phone: { businessId: appointment.businessId, phone } },
    create: {
      businessId: appointment.businessId,
      name: appointment.customerName || phone,
      phone,
      email: appointment.customerEmail || null,
      ...(dateOfBirth ? { dateOfBirth } : {}),
      totalVisits: 1,
      monthlyVisits: isCurrentMonth ? 1 : 0,
      lastVisitAt: visitDate,
    },
    update: {
      name: appointment.customerName || phone,
      email: appointment.customerEmail || null,
      ...(dateOfBirth ? { dateOfBirth } : {}),
      totalVisits: { increment: 1 },
      ...(isCurrentMonth ? { monthlyVisits: { increment: 1 } } : {}),
      lastVisitAt: visitDate,
    },
  });
}

export async function updateCustomerProfile(client, { businessId, name, phone, email, dateOfBirth }) {
  const normalizedPhone = normalizePhone(phone);
  if (!businessId || !normalizedPhone) return null;
  if (!(await customerHubEnabled(client, businessId))) return null;

  const parsedDateOfBirth = parseDateOfBirth(dateOfBirth);
  return client.customer.upsert({
    where: { businessId_phone: { businessId, phone: normalizedPhone } },
    create: {
      businessId,
      name: name || normalizedPhone,
      phone: normalizedPhone,
      email: email || null,
      ...(parsedDateOfBirth ? { dateOfBirth: parsedDateOfBirth } : {}),
    },
    update: {
      ...(name !== undefined ? { name: name || normalizedPhone } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(dateOfBirth !== undefined ? { dateOfBirth: parsedDateOfBirth } : {}),
    },
  });
}

export async function recordCustomerPayment(client, appointment) {
  const phone = normalizePhone(appointment.customerPhone);
  if (!phone) return null;

  const business = await client.business.findUnique({
    where: { id: appointment.businessId },
    select: { customerHubEnabled: true, customerPointsPercent: true },
  });
  if (!business?.customerHubEnabled) return null;

  const amount = Number(appointment.paymentAmount || appointment.service?.price || 0);
  const points = amount * Number(business.customerPointsPercent || 0) / 100;
  const paidAt = appointment.paidAt ? new Date(appointment.paidAt) : new Date();
  const { start, end } = monthBounds(new Date());
  const isCurrentMonth = paidAt >= start && paidAt < end;

  return client.customer.upsert({
    where: { businessId_phone: { businessId: appointment.businessId, phone } },
    create: {
      businessId: appointment.businessId,
      name: appointment.customerName || phone,
      phone,
      email: appointment.customerEmail || null,
      totalVisits: 0,
      totalPaid: amount,
      monthlyPaid: isCurrentMonth ? amount : 0,
      points,
      lastPaidAt: paidAt,
    },
    update: {
      name: appointment.customerName || phone,
      email: appointment.customerEmail || null,
      totalPaid: { increment: amount },
      ...(isCurrentMonth ? { monthlyPaid: { increment: amount } } : {}),
      points: { increment: points },
      lastPaidAt: paidAt,
    },
  });
}
