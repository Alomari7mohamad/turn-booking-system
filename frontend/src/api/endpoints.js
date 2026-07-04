import { api } from "./client.js";

// تجميع نداءات الـ API حسب المجال — يبقي المكوّنات نظيفة.
export const authApi = {
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data).then((r) => r.data),
  resetPassword: (data) => api.post("/auth/reset-password", data).then((r) => r.data),
};

export const adminApi = {
  stats: () => api.get("/admin/stats").then((r) => r.data),
  analytics: (params) => api.get("/admin/analytics", { params }).then((r) => r.data),
  listManagers: () => api.get("/admin/managers").then((r) => r.data),
  createManager: (data) => api.post("/admin/managers", data).then((r) => r.data),
  updateManager: (id, data) => api.patch(`/admin/managers/${id}`, data).then((r) => r.data),
  listBusinesses: (search) =>
    api.get("/admin/businesses", { params: { search } }).then((r) => r.data),
  getBusiness: (id) => api.get(`/admin/businesses/${id}`).then((r) => r.data),
  createBusiness: (data) => api.post("/admin/businesses", data).then((r) => r.data),
  updateBusiness: (id, data) => api.patch(`/admin/businesses/${id}`, data).then((r) => r.data),
  toggleStatus: (id, isActive) =>
    api.patch(`/admin/businesses/${id}/status`, { isActive }).then((r) => r.data),
  updateSubscription: (id, data) =>
    api.patch(`/admin/businesses/${id}/subscription`, data).then((r) => r.data),
  upsertOwner: (id, data) => api.patch(`/admin/businesses/${id}/owner`, data).then((r) => r.data),
  overrideAppointmentPayment: (id, paymentStatus) =>
    api.patch(`/admin/appointments/${id}/payment`, { paymentStatus }).then((r) => r.data),
};

const createBusinessScopedApi = (prefix) => ({
  me: () => api.get(`${prefix}/me`).then((r) => r.data),
  update: (data) => api.patch(`${prefix}/me`, data).then((r) => r.data),
  dashboard: () => api.get(`${prefix}/dashboard`).then((r) => r.data),
  customers: (params) => api.get(`${prefix}/customers`, { params }).then((r) => r.data),
  updateCustomerSettings: (data) =>
    api.patch(`${prefix}/customers/settings`, data).then((r) => r.data),
  customerDetails: (phone, params) =>
    api.get(`${prefix}/customers/${encodeURIComponent(phone)}/details`, { params }).then((r) => r.data),
  customerReviews: (phone) =>
    api.get(`${prefix}/customers/${encodeURIComponent(phone)}/reviews`).then((r) => r.data),

  listEmployees: () => api.get(`${prefix}/employees`).then((r) => r.data),
  createEmployee: (d) => api.post(`${prefix}/employees`, d).then((r) => r.data),
  updateEmployee: (id, d) => api.patch(`${prefix}/employees/${id}`, d).then((r) => r.data),
  deleteEmployee: (id) => api.delete(`${prefix}/employees/${id}`).then((r) => r.data),
  getEmployeeWorkingHours: (id) => api.get(`${prefix}/employees/${id}/working-hours`).then((r) => r.data),
  setEmployeeWorkingHours: (id, days) =>
    api.put(`${prefix}/employees/${id}/working-hours`, { days }).then((r) => r.data),

  listServices: () => api.get(`${prefix}/services`).then((r) => r.data),
  createService: (d) => api.post(`${prefix}/services`, d).then((r) => r.data),
  updateService: (id, d) => api.patch(`${prefix}/services/${id}`, d).then((r) => r.data),
  deleteService: (id) => api.delete(`${prefix}/services/${id}`).then((r) => r.data),

  getWorkingHours: () => api.get(`${prefix}/working-hours`).then((r) => r.data),
  setWorkingHours: (days) => api.put(`${prefix}/working-hours`, { days }).then((r) => r.data),

  listBlockedTimes: () => api.get(`${prefix}/blocked-times`).then((r) => r.data),
  createBlockedTime: (d) => api.post(`${prefix}/blocked-times`, d).then((r) => r.data),
  deleteBlockedTime: (id) => api.delete(`${prefix}/blocked-times/${id}`).then((r) => r.data),

  listAppointments: (params) =>
    api.get(`${prefix}/appointments`, { params }).then((r) => r.data),
  updateAppointment: (id, d) => api.patch(`${prefix}/appointments/${id}`, d).then((r) => r.data),
  createReviewLink: (id) => api.post(`${prefix}/appointments/${id}/review-link`).then((r) => r.data),
  delayAppointment: (id, delayMinutes) =>
    api.patch(`${prefix}/appointments/${id}/delay`, { delayMinutes }).then((r) => r.data),
  requeueOptions: (id, params) =>
    api.get(`${prefix}/appointments/${id}/requeue-options`, { params }).then((r) => r.data),
  requeue: (id, data) =>
    api.patch(`${prefix}/appointments/${id}/requeue`, data).then((r) => r.data),
  cancelAppointment: (id) => api.delete(`${prefix}/appointments/${id}`).then((r) => r.data),
  updateAppointmentPayment: (id, paymentStatus) =>
    api.patch(`${prefix}/appointments/${id}/payment`, { paymentStatus }).then((r) => r.data),
  secretaryToday: (params) =>
    api.get(`${prefix}/secretary/today`, { params }).then((r) => r.data),
  openSecretarySession: (pin) =>
    api.post(`${prefix}/secretary/session`, { pin }).then((r) => r.data),
  secretaryLateTicket: (appointmentId) =>
    api.post(`${prefix}/secretary/late-ticket`, { appointmentId }).then((r) => r.data),
  notifications: () => api.get(`${prefix}/notifications`).then((r) => r.data),
  markNotificationsRead: () => api.patch(`${prefix}/notifications/read`).then((r) => r.data),
  deleteNotifications: () => api.delete(`${prefix}/notifications`).then((r) => r.data),
  auditLogs: () => api.get(`${prefix}/audit-logs`).then((r) => r.data),
});

export const businessApi = createBusinessScopedApi("/business");

export const adminManagedBusinessApi = (businessId) =>
  createBusinessScopedApi(`/admin/businesses/${businessId}/manage`);

export const staffApi = {
  appointments: (params) => api.get("/staff/appointments", { params }).then((r) => r.data),
  employees: () => api.get("/staff/employees").then((r) => r.data),
  updateStatus: (id, status) =>
    api.patch(`/staff/appointments/${id}/status`, { status }).then((r) => r.data),
  createReviewLink: (id) => api.post(`/staff/appointments/${id}/review-link`).then((r) => r.data),
  updatePayment: (id, paymentStatus) =>
    api.patch(`/staff/appointments/${id}/payment`, { paymentStatus }).then((r) => r.data),
  requeueOptions: (id, params) =>
    api.get(`/staff/appointments/${id}/requeue-options`, { params }).then((r) => r.data),
  requeue: (id, data) =>
    api.patch(`/staff/appointments/${id}/requeue`, data).then((r) => r.data),
};

export const publicApi = {
  business: (slug) => api.get(`/public/${slug}`).then((r) => r.data),
  availability: (slug, params) =>
    api.get(`/public/${slug}/availability`, { params }).then((r) => r.data),
  findAppointmentByPhone: (slug, phone) =>
    api.get(`/public/${slug}/appointments/by-phone`, { params: { phone } }).then((r) => r.data),
  updateCustomerProfile: (slug, data) =>
    api.patch(`/public/${slug}/customer-profile`, data).then((r) => r.data),
  printTicket: (slug, phone) =>
    api.get(`/public/${slug}/print-ticket`, { params: { phone } }).then((r) => r.data),
  sendPhoneVerification: (slug, phone) =>
    api.post(`/public/${slug}/phone-verifications`, { phone }).then((r) => r.data),
  confirmPhoneVerification: (slug, data) =>
    api.post(`/public/${slug}/phone-verifications/confirm`, data).then((r) => r.data),
  book: (slug, data) => api.post(`/public/${slug}/appointments`, data).then((r) => r.data),
  cancelAppointment: (slug, id, phone) =>
    api.delete(`/public/${slug}/appointments/${id}`, { data: { phone } }).then((r) => r.data),
  appointmentStatus: (id) => api.get(`/public/appointments/${id}/status`).then((r) => r.data),
  respondDelay: (id, response) =>
    api.post(`/public/appointments/${id}/delay-response`, { response }).then((r) => r.data),
  review: (token) => api.get(`/public/reviews/${token}`).then((r) => r.data),
  submitReview: (token, data) => api.post(`/public/reviews/${token}`, data).then((r) => r.data),
};

export const paymentApi = {
  info: (reference) => api.get(`/payments/${reference}`).then((r) => r.data),
  // محاكاة فقط: تحاكي رد البوابة (success | fail)
  mockComplete: (reference, outcome) =>
    api.post(`/payments/mock/${reference}/complete`, { outcome }).then((r) => r.data),
};
