import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { StatCard, Spinner, Badge, EmptyState, Button, fmtDate, fmtTime, fmtNumber, STATUS_META } from "../components/ui.jsx";

export default function BusinessDashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { api, basePath, business, isAdminManaging } = useBusinessManage();
  const currentBusiness = business || user?.business;
  const manualApproval = currentBusiness?.requiresAppointmentApproval !== false;
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState("");
  const [appointmentsView, setAppointmentsView] = useState("upcoming");

  const load = async () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    try {
      const requests = [
        api.dashboard(),
        api.listAppointments({ from: today, to: today }),
      ];
      if (manualApproval) requests.push(api.listAppointments({ status: "PENDING" }));
      const [dashboardResult, todayResult, pendingResult] = await Promise.all(requests);
      setData({
        ...dashboardResult,
        todayAppointments: todayResult.appointments || [],
        pendingAppointments: pendingResult?.appointments || [],
      });
    } catch {
      setData({ stats: {}, todayAppointments: [], pendingAppointments: [] });
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [api, manualApproval]);

  useEffect(() => {
    if (!manualApproval) setAppointmentsView("upcoming");
  }, [manualApproval]);

  const copyLink = async (url, key = "booking") => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? "" : current)), 3000);
    } catch {
      toast.error(t("bd.copyFailed"));
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.updateAppointment(id, { status });
      toast.success(status === "CONFIRMED" ? t("acceptedAppointment") : t("rejectedAppointment"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!data) return <Spinner page />;
  const s = data.stats || {};
  const bookingUrl = currentBusiness ? `${location.origin}/book/${currentBusiness.slug}` : "";
  const printUrl = currentBusiness?.slug && currentBusiness?.printScreenEnabled !== false ? `${location.origin}/print/${currentBusiness.slug}` : "";
  const statusLabel = (status) => ({
    PENDING: t("statusPending"),
    CONFIRMED: t("statusConfirmed"),
    COMPLETED: t("statusCompleted"),
    CANCELLED: t("statusCancelled"),
    NO_SHOW: t("statusNoShow"),
  }[status] || status);
  const now = new Date();
  const upcomingAppointments = (data.todayAppointments || [])
    .filter((appointment) => appointment.status === "CONFIRMED" && new Date(appointment.startAt) >= now)
    .sort((first, second) => new Date(first.startAt) - new Date(second.startAt));
  const pendingAppointments = (data.pendingAppointments || [])
    .filter((appointment) => appointment.status === "PENDING" && new Date(appointment.startAt) >= now)
    .sort((first, second) => new Date(first.startAt) - new Date(second.startAt));
  const visibleAppointments = appointmentsView === "confirmations"
    ? pendingAppointments
    : upcomingAppointments;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">
            {isAdminManaging ? `${t("managingBusiness")} ${currentBusiness?.name || t("businessFallback")}` : `${t("welcomeUser")} ${user?.name}`}
          </div>
          {isAdminManaging && <div className="page-sub">{t("remoteControlHelp")}</div>}
        </div>
      </div>

      {bookingUrl && (
        <div className="card card-pad" style={{ marginBottom: 18, background: "var(--primary-soft)", borderColor: "var(--primary-soft-2)" }}>
          <div className="row-between wrap" style={{ gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{t("publicBookingLink")}</div>
            </div>
            <div className="row">
              <code style={{ background: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>/book/{currentBusiness.slug}</code>
              <button className="btn btn-primary btn-sm" onClick={() => copyLink(bookingUrl, "booking")}>{t("copy")}</button>
              <a className="btn btn-ghost btn-sm" href={bookingUrl} target="_blank" rel="noreferrer">{t("open")}</a>
            </div>
          </div>
          {copied === "booking" && <div className="copy-inline-message">{t("bd.bookingLinkCopied")}</div>}
          {printUrl && (
            <div className="row-between wrap" style={{ gap: 14, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--primary-soft-2)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t("bd.printLink")}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>{t("bd.printLinkHint")}</div>
              </div>
              <div className="row">
                <code style={{ background: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>/print/{currentBusiness.slug}</code>
                <button className="btn btn-primary btn-sm" onClick={() => copyLink(printUrl, "print")}>{t("copy")}</button>
                <a className="btn btn-ghost btn-sm" href={printUrl} target="_blank" rel="noreferrer">{t("open")}</a>
              </div>
            </div>
          )}
          {copied === "print" && <div className="copy-inline-message">{t("bd.printLinkCopied")}</div>}
        </div>
      )}

      <div className="grid grid-stats">
        <StatCard icon="📅" value={fmtNumber(s.todayCount)} label={t("todayBookings")} tone="primary" />
        <StatCard icon="🗓️" value={fmtNumber(s.weekCount)} label={t("weekBookings")} tone="info" />
        <StatCard icon="👥" value={fmtNumber(s.employees)} label={t("navEmployees")} tone="success" />
        <StatCard icon="✂️" value={fmtNumber(s.services)} label={t("navServices")} tone="warning" />
      </div>

      <div className="card mt-3 dashboard-appointments">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              {appointmentsView === "confirmations" ? t("dashboard.confirmations") : t("dashboard.todayUpcoming")}
            </h3>
            {manualApproval && (
              <div className="dashboard-appointments-tabs" role="tablist" aria-label={t("dashboard.appointmentViews")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appointmentsView === "upcoming"}
                  className={appointmentsView === "upcoming" ? "active" : ""}
                  onClick={() => setAppointmentsView("upcoming")}
                >
                  {t("dashboard.todayUpcoming")}
                  <span>{fmtNumber(upcomingAppointments.length)}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appointmentsView === "confirmations"}
                  className={appointmentsView === "confirmations" ? "active" : ""}
                  onClick={() => setAppointmentsView("confirmations")}
                >
                  {t("dashboard.confirmations")}
                  <span>{fmtNumber(pendingAppointments.length)}</span>
                </button>
              </div>
            )}
          </div>
          <Link to={`${basePath}/appointments`} className="muted" style={{ fontSize: 13 }}>{t("allBookings")}</Link>
        </div>
        {visibleAppointments.length ? (
          <div className="dashboard-appointment-list">
            {visibleAppointments.map((appointment, index) => (
              <article className="dashboard-appointment-row" key={appointment.id}>
                <div className="dashboard-appointment-time">
                  <strong>{fmtTime(appointment.startAt)}</strong>
                  <span>{fmtTime(appointment.endAt)}</span>
                  <span>{fmtDate(appointment.startAt)}</span>
                  {appointmentsView === "upcoming" && index === 0 && (
                    <small>{t("dashboard.nearestAppointment")}</small>
                  )}
                </div>
                <div className="dashboard-appointment-customer">
                  <strong>{appointment.customerName}</strong>
                  <span>{appointment.customerPhone}</span>
                </div>
                <div className="dashboard-appointment-meta">
                  <strong>{appointment.service?.name}</strong>
                  <span>{appointment.employee?.name}</span>
                </div>
                {appointmentsView === "confirmations" ? (
                  <div className="dashboard-appointment-actions">
                    <Button size="sm" onClick={() => changeStatus(appointment.id, "CONFIRMED")}>{t("accept")}</Button>
                    <Button size="sm" variant="danger" onClick={() => changeStatus(appointment.id, "CANCELLED")}>{t("reject")}</Button>
                  </div>
                ) : (
                  <Badge tone={STATUS_META[appointment.status]?.tone}>{statusLabel(appointment.status)}</Badge>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={appointmentsView === "confirmations" ? t("dashboard.noConfirmations") : t("dashboard.noTodayUpcoming")}
          />
        )}
      </div>
    </>
  );
}
