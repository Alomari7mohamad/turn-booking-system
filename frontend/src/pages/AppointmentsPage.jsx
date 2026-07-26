import { useEffect, useState, useCallback } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import {
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Badge,
  EmptyState,
  fmtDate,
  fmtTime,
  fmtPrice,
  STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_META,
} from "../components/ui.jsx";
import { buildReviewUrl, buildReviewWhatsappUrl } from "../reviewLinks.js";
import { useLanguage } from "../context/LanguageContext.jsx";

function rangeFor(kind) {
  const today = new Date();
  const iso = (date) => date.toISOString().slice(0, 10);
  if (kind === "today") return { from: iso(today), to: iso(today) };
  if (kind === "week") {
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { from: iso(today), to: iso(end) };
  }
  return {};
}

function filterByMode(items, mode) {
  if (mode === "rejected") return items.filter((item) => item.status === "CANCELLED");
  if (mode === "archive") return items.filter((item) => item.status === "ARCHIVED");
  return items.filter((item) => ["CONFIRMED", "COMPLETED"].includes(item.status));
}

export default function AppointmentsPage({ mode = "bookings" }) {
  const toast = useToast();
  const { t, weekdayName } = useLanguage();
  const { api } = useBusinessManage();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [range, setRange] = useState("today");
  const [employeeId, setEmployeeId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [lateTarget, setLateTarget] = useState(null);
  const [lateMinutes, setLateMinutes] = useState(10);
  const [lateSaving, setLateSaving] = useState(false);

  const load = useCallback((silent = false) => {
    const params = { ...rangeFor(range) };
    if (employeeId) params.employeeId = employeeId;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    if (mode === "archive") {
      params.status = "ARCHIVED";
      params.includeArchived = "true";
    }
    if (!silent) setAppointments(null);
    api.listAppointments(params).then((result) => setAppointments(result.appointments));
  }, [api, range, employeeId, paymentStatus, mode]);

  useEffect(() => { api.listEmployees().then((result) => setEmployees(result.employees)); }, [api]);
  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const visibleAppointments = appointments ? filterByMode(appointments, mode) : null;
  const pageTitle = mode === "rejected" ? t("ap.rejectedTitle") : mode === "archive" ? t("navArchive") : t("navAppointments");
  const pageSub = mode === "rejected" ? t("ap.rejectedSub") : mode === "archive" ? t("ap.archiveSub") : t("ap.bookingsSub");

  const changeStatus = async (id, newStatus, successMessage) => {
    const msg = successMessage || t("ap.statusUpdated");
    try {
      await api.updateAppointment(id, { status: newStatus });
      toast.success(msg);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAction = (appointment, action) => {
    if (!action) return;
    if (action === "NO_SHOW") {
      changeStatus(appointment.id, "NO_SHOW", t("ap.markedNoShow"));
      return;
    }
    if (action === "LATE") {
      setLateTarget(appointment);
      setLateMinutes(10);
    }
  };

  const submitDelay = async (event) => {
    event.preventDefault();
    const minutes = Number(lateMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      toast.error(t("ap.enterDelay"));
      return;
    }

    setLateSaving(true);
    try {
      const result = await api.delayAppointment(lateTarget.id, minutes);
      toast.success(t("ap.delayed", { count: result.appointments?.length || 1 }));
      setLateTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLateSaving(false);
    }
  };

  const sendReviewLink = async (appointment) => {
    try {
      const result = await api.createReviewLink(appointment.id);
      const url = result.url || buildReviewUrl(result.path || result.token);
      const whatsappUrl = result.whatsapp || buildReviewWhatsappUrl(appointment.customerPhone, url, appointment.customerName);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      toast.success(t("ap.reviewReady"));
      load(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatAppointmentDate = (appointment) => {
    const start = new Date(appointment.startAt);
    return `${weekdayName(start, "long")} ${fmtDate(appointment.startAt)} ${t("sd.from")} ${fmtTime(appointment.startAt)} ${t("sd.until")} ${fmtTime(appointment.endAt)}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{pageTitle}</div>
          <div className="page-sub">{pageSub}</div>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>{t("ap.printSchedule")}</Button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap appointments-filters" style={{ gap: 10 }}>
          <div className="row appointments-range-filter" style={{ gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
            {[["today", t("sd.today")], ["week", t("sd.week")], ["all", t("sd.all")]].map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${range === key ? "btn-primary" : "btn-ghost"}`} style={range === key ? {} : { border: "none", background: "transparent" }} onClick={() => setRange(key)}>{label}</button>
            ))}
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 180 }}>
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">{t("sd.allStaff")}</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 160 }}>
            <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">{t("ap.allPayStatuses")}</option>
              {Object.entries(PAYMENT_STATUS_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <div className="card">
        {!visibleAppointments ? <Spinner page /> : visibleAppointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  <th>{t("employee")}</th>
                  <th>{t("sd.appointment")}</th>
                  <th>{t("status")}</th>
                  <th>{t("ap.payment")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppointments.map((appointment) => {
                  const amount = Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
                  const isFree = amount === 0;
                  const isRejected = appointment.status === "CANCELLED";
                  const canSendReview =
                    user?.business?.reviewsEnabled !== false &&
                    !appointment.review &&
                    new Date(appointment.endAt) <= new Date() &&
                    !["CANCELLED", "NO_SHOW", "ARCHIVED"].includes(appointment.status);

                  return (
                    <tr key={appointment.id}>
                      <td style={{ fontWeight: 600 }}>{appointment.customerName}<div className="soft" style={{ fontSize: 12 }}>{appointment.customerPhone}</div></td>
                      <td>{appointment.service?.name}<div className="soft" style={{ fontSize: 12 }}>{isFree ? t("bc.freeService") : fmtPrice(amount)}</div></td>
                      <td>{appointment.employee?.name}</td>
                      <td>{fmtDate(appointment.startAt)}<div className="soft" style={{ fontSize: 12 }}>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</div></td>
                      <td><Badge tone={STATUS_META[appointment.status]?.tone}>{STATUS_META[appointment.status]?.label}</Badge></td>
                      <td>
                        {isRejected ? <span className="soft">-</span> : <>
                          <div className="soft" style={{ fontSize: 12, marginBottom: 4 }}>
                            {isFree ? t("ap.noPayment") : appointment.paymentMethod ? PAYMENT_METHOD_META[appointment.paymentMethod]?.label : "-"}
                            {!isFree && appointment.paymentAmount ? ` - ${fmtPrice(appointment.paymentAmount)}` : ""}
                          </div>
                          {isFree ? (
                            <Badge tone="success">{t("bc.freeService")}</Badge>
                          ) : (
                            <Badge tone={PAYMENT_STATUS_META[appointment.paymentStatus]?.tone}>{PAYMENT_STATUS_META[appointment.paymentStatus]?.label}</Badge>
                          )}
                        </>}
                      </td>
                      <td>
                        <div className="appointments-actions-cell">
                          {mode === "bookings" && (appointment.paymentStatus === "PAID" || appointment.status === "COMPLETED") ? (
                            <Badge tone="success">{t("sd.customerAttended")}</Badge>
                          ) : mode === "bookings" ? (
                            <Select value="" onChange={(event) => handleAction(appointment, event.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
                              <option value="">{t("ap.chooseAction")}</option>
                              <option value="LATE">{t("ap.late")}</option>
                              <option value="NO_SHOW">{t("statusNoShow")}</option>
                            </Select>
                          ) : <span className="soft">-</span>}
                          {canSendReview && (
                            <Button size="sm" variant="secondary" onClick={() => sendReviewLink(appointment)}>{t("sd.sendReview")}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("ap.noBookings")} hint={t("ap.tryFilters")} />
        )}
      </div>

      <div className="appointments-print-page" dir="rtl">
        <h1>{t("ap.scheduleTitle")}</h1>
        {visibleAppointments?.length ? visibleAppointments.map((appointment) => (
          <div key={appointment.id} className="print-appointment">
            <div className="print-customer"><strong>{appointment.customerName}</strong><span>{appointment.customerPhone}</span></div>
            <div>{t("sd.bookingTime")}: {formatAppointmentDate(appointment)}</div>
            <div>{t("sd.bookingType")}: {appointment.service?.name || "-"}</div>
            <div>{t("sd.amount")}: {Number(appointment.paymentAmount ?? appointment.service?.price ?? 0) === 0 ? t("bc.freeService") : fmtPrice(appointment.paymentAmount ?? appointment.service?.price ?? 0)}</div>
          </div>
        )) : <div className="muted">{t("ap.noBookingsToPrint")}</div>}
      </div>

      <Modal
        open={!!lateTarget}
        onClose={() => setLateTarget(null)}
        title={t("ap.delayTitle")}
        footer={<><Button form="late-form" type="submit" loading={lateSaving}>{t("ap.confirmDelay")}</Button><Button variant="ghost" onClick={() => setLateTarget(null)}>{t("cancel")}</Button></>}
      >
        <form id="late-form" onSubmit={submitDelay} className="col" style={{ gap: 14 }}>
          <div className="soft">{t("ap.delayNote")}</div>
          <Field label={t("ap.delayMinutes")}><Input type="number" min="1" step="1" value={lateMinutes} onChange={(event) => setLateMinutes(event.target.value)} autoFocus /></Field>
        </form>
      </Modal>
    </>
  );
}
