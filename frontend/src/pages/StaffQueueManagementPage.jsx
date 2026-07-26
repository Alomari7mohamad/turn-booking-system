import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { staffApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { Badge, Button, EmptyState, Field, Input, Spinner, fmtDate, fmtPrice, fmtTime, PAYMENT_STATUS_META, STATUS_META } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";

const FILTERS = [
  { key: "all", labelKey: "bm.filterAll" },
  { key: "late", labelKey: "bm.filterLate" },
  { key: "rejected", labelKey: "bm.filterRejected" },
  { key: "paidExpired", labelKey: "bm.filterPaid" },
  { key: "noShow", labelKey: "statusNoShow" },
];

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

export default function StaffQueueManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [requeue, setRequeue] = useState(null);
  const [requeueDate, setRequeueDate] = useState(today);
  const [requeueLoading, setRequeueLoading] = useState(false);
  const appointments = data?.appointments || [];
  const groups = useMemo(() => ({
    all: appointments.filter((item) => {
      const date = new Date(item.startAt).toISOString().slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    }),
    late: appointments.filter((item) => isExpired(item) && !isPaid(item) && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(item.status)),
    rejected: appointments.filter((item) => item.status === "CANCELLED"),
    paidExpired: appointments.filter((item) => isExpired(item) && isPaid(item)),
    noShow: appointments.filter((item) => item.status === "NO_SHOW"),
  }), [appointments, from, to]);
  const rows = groups[filter] || [];

  const load = () => {
    setData(null);
    staffApi.appointments()
      .then(setData)
      .catch((err) => {
        toast.error(err.message);
        setData({ appointments: [] });
      });
  };

  useEffect(() => { load(); }, []);

  if (user?.staffRole !== "SECRETARY") return <Navigate to="/staff" replace />;
  if (!data) return <Spinner page />;

  const markNoShow = async (appointment) => {
    try {
      await staffApi.updateStatus(appointment.id, "NO_SHOW");
      toast.success(t("sq.markedNoShow"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadRequeueOptions = async (appointment, date = requeueDate) => {
    setRequeue({ appointment, loading: true, options: null });
    try {
      const options = await staffApi.requeueOptions(appointment.id, { date });
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
      await staffApi.requeue(requeue.appointment.id, {
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

  return (
    <div data-no-auto-translate="true">
      <div className="page-head">
        <div>
          <div className="page-title">{t("navQueueManagement")}</div>
          <div className="page-sub">{t("sq.sub")}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row wrap" style={{ gap: 8 }}>
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
          <div className="grid grid-2 mt-3">
            <Field label={t("cust.fromDate")}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("cust.toDate")}>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className="card mt-3">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  <th>{t("employee")}</th>
                  <th>{t("sd.appointment")}</th>
                  <th>{t("sd.amount")}</th>
                  <th>{t("status")}</th>
                  <th>{t("ap.payment")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((appointment) => {
                  const amount = amountOf(appointment);
                  const paid = isPaid(appointment);
                  return (
                    <tr key={appointment.id}>
                      <td style={{ fontWeight: 700 }}>{appointment.customerName}<div className="soft">{appointment.customerPhone}</div></td>
                      <td>{appointment.service?.name}</td>
                      <td>{appointment.employee?.name || "-"}</td>
                      <td>{fmtDate(appointment.startAt)} <span className="soft">{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</span></td>
                      <td>{amount === 0 ? t("pb.free") : fmtPrice(amount)}</td>
                      <td><Badge tone={STATUS_META[appointment.status]?.tone}>{STATUS_META[appointment.status]?.label || appointment.status}</Badge></td>
                      <td>
                        {queuePaymentLabel(appointment, filter) === "-" ? (
                          <span className="soft">-</span>
                        ) : (
                          <Badge tone={paid ? "success" : "warning"}>{queuePaymentLabel(appointment, filter)}</Badge>
                        )}
                      </td>
                      <td>
                        {filter === "late" ? (
                          <div className="row wrap" style={{ gap: 6 }}>
                            <Button size="sm" variant="ghost" onClick={() => markNoShow(appointment)}>{t("statusNoShow")}</Button>
                            <Button size="sm" variant="secondary" onClick={() => openRequeue(appointment)}>{t("bm.requeueBtn")}</Button>
                          </div>
                        ) : (
                          <span className="soft">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("bm.noRows")} hint={t("sq.noRowsHint")} />
        )}
      </div>

      <Modal
        open={!!requeue}
        onClose={() => setRequeue(null)}
        title={t("bm.chooseNewTime")}
        large
      >
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
                    <Button key={`${slot.employeeId}-${slot.startAt}`} size="sm" loading={requeueLoading} onClick={() => chooseSlot(slot)}>
                      {fmtTime(slot.startAt)} - {fmtTime(slot.endAt)}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="soft" style={{ marginTop: 8 }}>{t("sq.requestedUnavailable")}</div>
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
                      <div className="soft">{fmtTime(slot.startAt)} - {fmtTime(slot.endAt)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="soft" style={{ marginTop: 8 }}>{t("sq.noOtherStaff")}</div>
              )}
            </div>

            {!requeue.options.originalSlots?.length && !requeue.options.alternativeSlots?.length && (
              <Button
                variant="ghost"
                onClick={() => window.open(`/book/${user?.business?.slug || ""}`, "_blank")}
              >
                {t("bm.bookNew")}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
