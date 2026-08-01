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

function archivedOriginalStatus(appointment) {
  const match = String(appointment?.notes || "").match(/\[ARCHIVED_FROM:([A-Z_]+)\]/);
  if (match?.[1]) return match[1];
  if (String(appointment?.notes || "").includes("[REJECTED_BY_BUSINESS]")) return "CANCELLED";
  return null;
}

function filterArchive(items, category) {
  if (category === "rejected") {
    return items.filter((item) => archivedOriginalStatus(item) === "CANCELLED");
  }
  if (category === "paid") return items.filter((item) => item.paymentStatus === "PAID");
  if (category === "noShow") {
    return items.filter((item) => archivedOriginalStatus(item) === "NO_SHOW");
  }
  return items;
}

export default function AppointmentsPage({ mode = "bookings" }) {
  const toast = useToast();
  const { t, weekdayName } = useLanguage();
  const { api, business } = useBusinessManage();
  const { user } = useAuth();
  const activeBusiness = business || user?.business || null;
  const [appointments, setAppointments] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [range, setRange] = useState(() => (mode === "archive" ? "all" : "today"));
  const [employeeId, setEmployeeId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [lateTarget, setLateTarget] = useState(null);
  const [lateMinutes, setLateMinutes] = useState(10);
  const [lateSaving, setLateSaving] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState("all");

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

  const modeAppointments = appointments ? filterByMode(appointments, mode) : null;
  const visibleAppointments = modeAppointments && mode === "archive"
    ? filterArchive(modeAppointments, archiveFilter)
    : modeAppointments;
  const pageTitle = mode === "rejected" ? t("ap.rejectedTitle") : mode === "archive" ? t("navArchive") : t("navAppointments");
  const pageSub = mode === "rejected" ? t("ap.rejectedSub") : mode === "archive" ? t("ap.archiveSub") : t("ap.bookingsSub");

  const printSchedule = () => {
    if (!visibleAppointments?.length) {
      toast.error(t("ap.noBookingsToPrint"));
      return;
    }
    window.print();
  };

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

  const openInvoiceFormats = (appointment) => {
    if (appointment.paymentStatus !== "PAID") {
      toast.error(t("acct.cantPrintUnpaid"));
      return;
    }
    setInvoiceTarget(appointment);
  };

  const printInvoice = (format) => {
    const appointment = invoiceTarget;
    if (!appointment) return;
    setInvoiceTarget(null);
    setInvoice({ appointment, format });
    const clearInvoice = () => {
      setInvoice(null);
      window.removeEventListener("afterprint", clearInvoice);
    };
    window.addEventListener("afterprint", clearInvoice);
    requestAnimationFrame(() => setTimeout(() => window.print(), 60));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{pageTitle}</div>
          <div className="page-sub">{pageSub}</div>
        </div>
        <Button variant="ghost" onClick={printSchedule}>{t("ap.printSchedule")}</Button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        {mode === "archive" && (
          <div className="booking-management-filters appointments-archive-filters" role="tablist">
            {[
              ["all", t("bm.filterAll")],
              ["rejected", t("bm.filterRejected")],
              ["paid", t("bm.filterPaid")],
              ["noShow", t("statusNoShow")],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={archiveFilter === key}
                className={`btn btn-sm ${archiveFilter === key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setArchiveFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
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

      <div className="appointments-results">
        {!visibleAppointments ? <Spinner page /> : visibleAppointments.length ? (
          <div className={`appointments-card-list appointments-card-list--${mode}`}>
            {visibleAppointments.map((appointment) => {
              const amount = Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
              const isFree = amount === 0;
              const originalStatus = mode === "archive" ? archivedOriginalStatus(appointment) : null;
              const displayStatus = originalStatus || appointment.status;
              const isRejected = displayStatus === "CANCELLED";
              const canSendReview =
                activeBusiness?.reviewsEnabled !== false &&
                !appointment.review &&
                Date.now() >= new Date(appointment.endAt).getTime() + (2 * 60 * 1000) &&
                !["CANCELLED", "NO_SHOW", "ARCHIVED"].includes(appointment.status);

              return (
                <article
                  className={`appointment-record-card appointment-record-card--${String(appointment.status || "unknown").toLowerCase()}`}
                  key={appointment.id}
                >
                  <header className="appointment-record-head">
                    <div className="appointment-customer">
                      <div className="appointment-customer-main">
                        <strong>{appointment.customerName}</strong>
                        <span className="appointment-service-name">{appointment.service?.name || "-"}</span>
                      </div>
                      <a className="appointment-customer-phone" href={`tel:${appointment.customerPhone}`} dir="ltr">
                        {appointment.customerPhone}
                      </a>
                    </div>
                    <div className="appointment-head-actions">
                      {mode === "bookings" && (appointment.paymentStatus === "PAID" || appointment.status === "COMPLETED") ? (
                        <Badge tone="success">{t("sd.customerAttended")}</Badge>
                      ) : mode === "bookings" ? (
                        <Select
                          value=""
                          aria-label={t("ap.chooseAction")}
                          onChange={(event) => handleAction(appointment, event.target.value)}
                        >
                          <option value="">{t("ap.chooseAction")}</option>
                          <option value="LATE">{t("ap.late")}</option>
                          <option value="NO_SHOW">{t("statusNoShow")}</option>
                        </Select>
                      ) : (
                        <Badge tone={STATUS_META[displayStatus]?.tone}>{STATUS_META[displayStatus]?.label}</Badge>
                      )}
                      {canSendReview && (
                        <Button size="sm" variant="secondary" onClick={() => sendReviewLink(appointment)}>{t("ap.sendReviewWhatsapp")}</Button>
                      )}
                      {mode === "archive" && appointment.paymentStatus === "PAID" && (
                        <Button size="sm" variant="ghost" onClick={() => openInvoiceFormats(appointment)}>
                          {t("acct.printInvoice")}
                        </Button>
                      )}
                    </div>
                  </header>

                  <div className="appointment-record-details">
                    <div className="appointment-record-field">
                      <span>{t("employee")}</span>
                      <strong>{appointment.employee?.name || "-"}</strong>
                    </div>
                    <div className="appointment-record-field">
                      <span>{t("sd.appointment")}</span>
                      <strong>{fmtDate(appointment.startAt)}</strong>
                      <small dir="ltr">{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</small>
                    </div>
                    <div className="appointment-record-field appointment-payment-field">
                      <span>{t("ap.payment")}</span>
                      {isRejected ? <strong className="soft">-</strong> : (
                        <>
                          <strong>
                            {isFree
                              ? t("ap.noPayment")
                              : appointment.paymentMethod
                                ? PAYMENT_METHOD_META[appointment.paymentMethod]?.label
                                : "-"}
                          </strong>
                          <div className="appointment-payment-meta">
                            {!isFree && appointment.paymentAmount ? <small>{fmtPrice(appointment.paymentAmount)}</small> : null}
                            {isFree ? (
                              <Badge tone="success">{t("bc.freeService")}</Badge>
                            ) : (
                              <Badge tone={PAYMENT_STATUS_META[appointment.paymentStatus]?.tone}>
                                {PAYMENT_STATUS_META[appointment.paymentStatus]?.label}
                              </Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState title={t("ap.noBookings")} hint={t("ap.tryFilters")} />
          </div>
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

      {invoice && (
        <>
          <style>{`@media print { @page { size: ${invoice.format === "thermal" ? "80mm auto" : "A4"}; margin: ${invoice.format === "thermal" ? "4mm" : "14mm"}; } .appointments-print-page { display: none !important; } }`}</style>
          <div className={`invoice-print-page invoice-print-page--${invoice.format}`} dir="rtl">
            <div className="invoice-box">
              <div className="invoice-head">
                <div>
                  <h1>{t("acct.invoice")}</h1>
                  <p>{activeBusiness?.name || t("store")}</p>
                </div>
                <img src={activeBusiness?.logoUrl || "/oh-tech-logo.jpg"} alt={activeBusiness?.name || "O&H Tech"} />
              </div>
              <div className="invoice-meta">
                <span>{t("acct.invoiceNo")}: #{invoice.appointment.id}</span>
                <span>{t("acct.date")}: {fmtDate(new Date())}</span>
              </div>
              <div className="invoice-section-title">{t("invoiceCustomerDetails")}</div>
              <div className="invoice-lines">
                <div><span>{t("customer")}</span><strong>{invoice.appointment.customerName}</strong></div>
                <div><span>{t("phone")}</span><strong dir="ltr">{invoice.appointment.customerPhone}</strong></div>
              </div>
              <div className="invoice-section-title">{t("invoiceBookingDetails")}</div>
              <div className="invoice-lines">
                <div><span>{t("service")}</span><strong>{invoice.appointment.service?.name || "-"}</strong></div>
                <div><span>{t("employee")}</span><strong>{invoice.appointment.employee?.name || "-"}</strong></div>
                <div><span>{t("sd.appointment")}</span><strong>{fmtDate(invoice.appointment.startAt)} {fmtTime(invoice.appointment.startAt)} - {fmtTime(invoice.appointment.endAt)}</strong></div>
              </div>
              <div className="invoice-totals">
                <div><span>{t("invoiceBeforeTax")}</span><strong>{fmtPrice(Number(invoice.appointment.paymentAmount ?? invoice.appointment.service?.price ?? 0) * 0.82)}</strong></div>
                <div><span>{t("invoiceTax18")}</span><strong>{fmtPrice(Number(invoice.appointment.paymentAmount ?? invoice.appointment.service?.price ?? 0) * 0.18)}</strong></div>
                <div className="invoice-total"><span>{t("invoiceFinalPrice")}</span><strong>{fmtPrice(Number(invoice.appointment.paymentAmount ?? invoice.appointment.service?.price ?? 0))}</strong></div>
              </div>
              <p className="invoice-tax-note">{t("invoiceTaxIncludedNote")}</p>
              <p className="invoice-thanks">{t("invoiceSeeYouAgain")}</p>
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title={t("invoiceChooseFormat")}
      >
        <div className="invoice-format-options">
          <button type="button" onClick={() => printInvoice("a4")}>
            <strong>{t("invoiceA4")}</strong>
            <span>{t("invoiceA4Hint")}</span>
          </button>
          <button type="button" onClick={() => printInvoice("thermal")}>
            <strong>{t("invoiceThermal80")}</strong>
            <span>{t("invoiceThermalHint")}</span>
          </button>
        </div>
      </Modal>

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
