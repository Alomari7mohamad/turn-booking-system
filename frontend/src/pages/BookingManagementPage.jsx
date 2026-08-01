import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { buildReviewUrl, buildReviewWhatsappUrl, buildWhatsappMessageUrl } from "../reviewLinks.js";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Spinner,
  fmtDate,
  fmtPrice,
  fmtTime,
  PAYMENT_STATUS_META,
  STATUS_META,
} from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";

const FILTERS = [
  { key: "all", labelKey: "bm.filterAll" },
  { key: "late", labelKey: "bm.filterLate" },
  { key: "rejected", labelKey: "bm.filterRejected" },
  { key: "paidExpired", labelKey: "bm.filterPaid" },
  { key: "noShow", labelKey: "statusNoShow" },
];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function isExpired(appointment) {
  return new Date(appointment.endAt) < new Date();
}

function queuePaymentLabel(appointment, filter) {
  if (appointment.status === "CANCELLED") return "-";
  if (["paidExpired", "noShow"].includes(filter) && appointment.paymentMethod !== "ONLINE") return "-";
  if (appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID") return i18n.t("acct.paidOnlineNoShow");
  if (amountOf(appointment) === 0) return i18n.t("pb.free");
  return PAYMENT_STATUS_META[appointment.paymentStatus]?.label || appointment.paymentStatus;
}

export default function BookingManagementPage({ lateOnly = false }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { api, business } = useBusinessManage();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayInput();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(() => (lateOnly ? "late" : "all"));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [requeue, setRequeue] = useState(null);
  const [requeueDate, setRequeueDate] = useState(today);
  const [requeueLoading, setRequeueLoading] = useState(false);

  const appointments = data?.appointments || [];
  const groups = useMemo(
    () => ({
      all: appointments.filter((item) => {
        const date = new Date(item.startAt).toISOString().slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
      }),
      late: appointments.filter(
        (item) =>
          isExpired(item) &&
          item.status === "CONFIRMED"
      ),
      rejected: appointments.filter((item) => item.status === "CANCELLED"),
      paidExpired: appointments.filter((item) => isExpired(item) && isPaid(item)),
      noShow: appointments.filter((item) => item.status === "NO_SHOW"),
    }),
    [appointments, from, to]
  );
  const rows = groups[filter] || [];
  const currentBusiness = business || user?.business;

  const load = () => {
    setData(null);
    api
      .listAppointments()
      .then(setData)
      .catch((err) => {
        toast.error(err.message);
        setData({ appointments: [] });
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (!data) return <Spinner page />;

  const markNoShow = async (appointment) => {
    try {
      await api.updateAppointment(appointment.id, { status: "NO_SHOW" });
      toast.success(t("bm.movedNoShow"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadRequeueOptions = async (appointment, date = requeueDate) => {
    setRequeue({ appointment, loading: true, options: null });
    try {
      const options = await api.requeueOptions(appointment.id, { date });
      setRequeue({ appointment, loading: false, options });
    } catch (err) {
      toast.error(err.message);
      setRequeue(null);
    }
  };

  const openRequeue = async (appointment) => {
    setRequeueDate(today);
    await loadRequeueOptions(appointment, today);
  };

  const changeRequeueDate = async (date) => {
    setRequeueDate(date);
    if (requeue?.appointment) await loadRequeueOptions(requeue.appointment, date);
  };

  const chooseSlot = async (slot) => {
    if (!requeue?.appointment) return;
    setRequeueLoading(true);
    try {
      await api.requeue(requeue.appointment.id, {
        employeeId: slot.employeeId,
        startAt: slot.startAt,
      });
      toast.success(t("bm.requeued"));
      setRequeue(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRequeueLoading(false);
    }
  };

  const openPublicBooking = () => {
    if (currentBusiness?.slug) {
      window.open(`/book/${currentBusiness.slug}`, "_blank");
    } else {
      navigate("/dashboard/appointments");
    }
  };

  const sendReviewLink = async (appointment) => {
    try {
      const result = await api.createReviewLink(appointment.id);
      const url = buildReviewUrl(result.path || result.token);
      window.open(buildReviewWhatsappUrl(appointment.customerPhone, url, appointment.customerName), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const askAboutNoShow = (appointment) => {
    const message = t("noShowWhatsappMessage", { name: appointment.customerName || "" });
    window.open(
      buildWhatsappMessageUrl(appointment.customerPhone, message),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{lateOnly ? t("navLateAppointments") : t("navAppointmentsManagement")}</div>
          <div className="page-sub">{lateOnly ? t("bm.lateSub") : t("bm.sub")}</div>
        </div>
      </div>

      {!lateOnly && (
        <div className="card card-pad">
          <div className="booking-management-filters">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className={`btn btn-sm ${filter === item.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setFilter(item.key)}
                type="button"
              >
                {t(item.labelKey)} ({groups[item.key]?.length || 0})
              </button>
            ))}
          </div>
          {filter === "all" && (
          <div className="booking-management-dates mt-3">
            <Field label={t("cust.fromDate")}>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label={t("cust.toDate")}>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
          )}
        </div>
      )}

      <section className="booking-management-results mt-3">
        {rows.length ? (
          <div className="booking-management-card-grid">
            {rows.map((appointment) => {
              const amount = amountOf(appointment);
              const paid = isPaid(appointment);
              const paymentLabel = queuePaymentLabel(appointment, filter);
              const canSendReview = appointment.status === "COMPLETED" && currentBusiness?.reviewsEnabled && !appointment.review;
              const isNoShow = appointment.status === "NO_SHOW";
              const hasActions = canSendReview || filter === "late";

              return (
                <article className="booking-management-card" key={appointment.id}>
                  <header className={`booking-management-card-head${isNoShow ? " is-no-show" : ""}`}>
                    <div className="booking-management-customer">
                      <div className="booking-management-customer-title">
                        <strong>{appointment.customerName}</strong>
                        <span>{appointment.service?.name || "-"}</span>
                      </div>
                      <a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a>
                    </div>
                    <div className="booking-management-head-actions">
                      {isNoShow && (
                        <button
                          type="button"
                          className="no-show-whatsapp-button"
                          onClick={() => askAboutNoShow(appointment)}
                        >
                          {t("sendNoShowWhatsappShort")}
                        </button>
                      )}
                      <Badge tone={STATUS_META[appointment.status]?.tone}>
                        {STATUS_META[appointment.status]?.label || appointment.status}
                      </Badge>
                    </div>
                  </header>

                  <div className={`booking-management-card-details${isNoShow ? " is-no-show" : ""}`}>
                    <div>
                      <span>{t("employee")}</span>
                      <strong>{appointment.employee?.name || "-"}</strong>
                    </div>
                    <div>
                      <span>{t("sd.appointment")}</span>
                      <strong>{fmtDate(appointment.startAt)}</strong>
                      <small>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</small>
                    </div>
                    {!isNoShow && (
                      <div className="booking-management-payment">
                        <span>{t("ap.payment")}</span>
                        <strong>{amount === 0 ? t("pb.free") : fmtPrice(amount)}</strong>
                        {paymentLabel === "-" ? (
                          <small>-</small>
                        ) : (
                          <Badge tone={paid ? "success" : "warning"}>{paymentLabel}</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {hasActions && (
                    <footer className="booking-management-card-actions">
                      {canSendReview ? (
                        <Button size="sm" variant="primary" onClick={() => sendReviewLink(appointment)}>
                          {t("sd.sendReview")}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => markNoShow(appointment)}>
                            {t("statusNoShow")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openRequeue(appointment)}>
                            {t("bm.requeueBtn")}
                          </Button>
                        </>
                      )}
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              title={t("bm.noRows")}
              hint={t("bm.noRowsHint")}
            />
          </div>
        )}
      </section>

      <Modal open={!!requeue} onClose={() => setRequeue(null)} title={t("bm.chooseNewTime")} large>
        {!requeue || requeue.loading ? (
          <Spinner />
        ) : (
          <div className="col" style={{ gap: 18 }}>
            <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
              <strong>{requeue.appointment.customerName}</strong>
              <div className="soft">{t("service")}: {requeue.appointment.service?.name}</div>
              <div className="soft">{t("bm.requestedStaff")}: {requeue.options.originalEmployee?.name}</div>
              <div className="soft">{t("phone")}: {requeue.appointment.customerPhone}</div>
            </div>

            <Field label={t("bm.chooseDay")}>
              <Input type="date" value={requeueDate} onChange={(event) => changeRequeueDate(event.target.value)} />
            </Field>

            <div className="help-text">
              {t("bm.requeueHelp")}
            </div>

            <div>
              <h3 className="card-title">{t("bm.slotsRequested")}</h3>
              {requeue.options.originalSlots?.length ? (
                <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                  {requeue.options.originalSlots.map((slot) => (
                    <Button
                      key={`${slot.employeeId}-${slot.startAt}`}
                      size="sm"
                      loading={requeueLoading}
                      onClick={() => chooseSlot(slot)}
                    >
                      {fmtTime(slot.startAt)} - {fmtTime(slot.endAt)}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="soft" style={{ marginTop: 8 }}>
                  {t("bm.requestedUnavailable")}
                </div>
              )}
            </div>

            <div>
              <h3 className="card-title">{t("bm.otherStaff")}</h3>
              {requeue.options.alternativeSlots?.length ? (
                <div className="grid grid-2 mt-2">
                  {requeue.options.alternativeSlots.map((slot) => (
                    <button
                      key={`${slot.employeeId}-${slot.startAt}`}
                      type="button"
                      className="card card-pad"
                      style={{ textAlign: "start", cursor: "pointer" }}
                      disabled={requeueLoading}
                      onClick={() => chooseSlot(slot)}
                    >
                      <strong>{slot.employeeName}</strong>
                      <div className="soft">
                        {fmtTime(slot.startAt)} - {fmtTime(slot.endAt)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="soft" style={{ marginTop: 8 }}>
                  {t("bm.noOtherStaff")}
                </div>
              )}
            </div>

            {!requeue.options.originalSlots?.length && !requeue.options.alternativeSlots?.length && (
              <Button variant="ghost" onClick={openPublicBooking}>
                {t("bm.bookNew")}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
