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
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState("");

  const load = () => api.dashboard().then(setData).catch(() => setData({ stats: {}, upcoming: [] }));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [api]);

  const copyLink = async (url, key = "booking") => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? "" : current)), 3000);
    } catch {
      toast.error("تعذر نسخ الرابط");
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
  const currentBusiness = business || user?.business;
  const bookingUrl = currentBusiness ? `${location.origin}/book/${currentBusiness.slug}` : "";
  const printUrl = currentBusiness?.slug && currentBusiness?.printScreenEnabled !== false ? `${location.origin}/print/${currentBusiness.slug}` : "";
  const statusLabel = (status) => ({
    PENDING: t("statusPending"),
    CONFIRMED: t("statusConfirmed"),
    COMPLETED: t("statusCompleted"),
    CANCELLED: t("statusCancelled"),
    NO_SHOW: t("statusNoShow"),
  }[status] || status);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">
            {isAdminManaging ? `${t("managingBusiness")} ${currentBusiness?.name || t("businessFallback")}` : `${t("welcomeUser")} ${user?.name}`}
          </div>
          <div className="page-sub">{isAdminManaging ? t("remoteControlHelp") : t("todayActivitySummary")}</div>
        </div>
      </div>

      {bookingUrl && (
        <div className="card card-pad" style={{ marginBottom: 18, background: "var(--primary-soft)", borderColor: "var(--primary-soft-2)" }}>
          <div className="row-between wrap" style={{ gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{t("publicBookingLink")}</div>
              <div className="muted" style={{ fontSize: 13.5 }}>{t("shareBookingLink")}</div>
            </div>
            <div className="row">
              <code style={{ background: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>/book/{currentBusiness.slug}</code>
              <button className="btn btn-primary btn-sm" onClick={() => copyLink(bookingUrl, "booking")}>{t("copy")}</button>
              <a className="btn btn-ghost btn-sm" href={bookingUrl} target="_blank" rel="noreferrer">{t("open")}</a>
            </div>
          </div>
          {copied === "booking" && <div className="copy-inline-message">تم نسخ رابط الحجز</div>}
          {printUrl && (
            <div className="row-between wrap" style={{ gap: 14, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--primary-soft-2)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>رابط شاشة الطباعة</div>
                <div className="muted" style={{ fontSize: 13.5 }}>افتحه داخل المحل ليستخرج الزبون ورقة الدور برقم هاتفه</div>
              </div>
              <div className="row">
                <code style={{ background: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>/print/{currentBusiness.slug}</code>
                <button className="btn btn-primary btn-sm" onClick={() => copyLink(printUrl, "print")}>{t("copy")}</button>
                <a className="btn btn-ghost btn-sm" href={printUrl} target="_blank" rel="noreferrer">{t("open")}</a>
              </div>
            </div>
          )}
          {copied === "print" && <div className="copy-inline-message">تم نسخ رابط شاشة الطباعة</div>}
        </div>
      )}

      <div className="grid grid-stats">
        <StatCard icon="📅" value={fmtNumber(s.todayCount)} label={t("todayBookings")} tone="primary" />
        <StatCard icon="🗓️" value={fmtNumber(s.weekCount)} label={t("weekBookings")} tone="info" />
        <StatCard icon="👥" value={fmtNumber(s.employees)} label={t("navEmployees")} tone="success" />
        <StatCard icon="✂️" value={fmtNumber(s.services)} label={t("navServices")} tone="warning" />
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">{t("upcomingAppointments")}</h3>
          <Link to={`${basePath}/appointments`} className="muted" style={{ fontSize: 13 }}>{t("allBookings")}</Link>
        </div>
        {data.upcoming?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("service")}</th>
                  <th>{t("employee")}</th>
                  <th>{t("appointmentTime")}</th>
                  <th>{t("status")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.customerName}<div className="soft" style={{ fontSize: 12 }}>{a.customerPhone}</div></td>
                    <td>{a.service?.name}</td>
                    <td>{a.employee?.name}</td>
                    <td>{fmtDate(a.startAt)} · {fmtTime(a.startAt)}</td>
                    <td><Badge tone={STATUS_META[a.status]?.tone}>{statusLabel(a.status)}</Badge></td>
                    <td>{a.status === "PENDING" ? <div className="row" style={{ gap: 6 }}><Button size="sm" onClick={() => changeStatus(a.id, "CONFIRMED")}>{t("accept")}</Button><Button size="sm" variant="danger" onClick={() => changeStatus(a.id, "CANCELLED")}>{t("reject")}</Button></div> : <span className="soft">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="📅" title={t("noUpcomingAppointments")} hint={t("newBookingsAppearHere")} />
        )}
      </div>
    </>
  );
}
