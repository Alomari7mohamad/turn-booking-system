import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/endpoints.js";
import { Badge, Button, Field, Input, Select, Spinner, fmtDate, fmtNumber, fmtPrice, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";
import { localeFor } from "../i18n/format.js";

const STATUS = {
  COMPLETED: { get label() { return i18n.t("stat.completed"); }, color: "#22c55e", tone: "success" },
  CONFIRMED: { get label() { return i18n.t("stat.confirmed"); }, color: "#3b82f6", tone: "info" },
  PENDING: { get label() { return i18n.t("stat.pending"); }, color: "#f59e0b", tone: "warning" },
  CANCELLED: { get label() { return i18n.t("stat.cancelled"); }, color: "#ef4444", tone: "danger" },
  NO_SHOW: { get label() { return i18n.t("statusNoShow"); }, color: "#94a3b8", tone: "muted" },
};

const HOURS = [8, 10, 12, 14, 16, 18, 20];

function dateInput(date) {
  return date.toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isPaid(appointment) {
  return appointment.paymentStatus === "PAID" || amountOf(appointment) === 0;
}

function needsRefund(appointment) {
  return appointment.status === "NO_SHOW" && appointment.paymentMethod === "ONLINE" && appointment.paymentStatus === "PAID";
}

function pct(value, total) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

function sum(items, getValue) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function compactDate(date) {
  return new Date(date).toLocaleDateString(localeFor(i18n.language), { day: "numeric", month: "short" });
}

function makePath(values, width = 124, height = 42) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function KpiCard({ icon, title, value, change, color, data }) {
  const path = makePath(data || []);
  return (
    <div className="report-kpi">
      <div className="report-kpi-top">
        <span className="report-kpi-icon" style={{ color, background: `${color}16` }}>{icon}</span>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <svg viewBox="0 0 124 42" className="report-sparkline" aria-hidden="true">
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="report-kpi-change" style={{ color }}>{change}</div>
    </div>
  );
}

function DonutChart({ total, segments, centerTitle, centerValue }) {
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="report-donut-wrap">
      <svg viewBox="0 0 120 120" className="report-donut">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        {segments.map((segment) => {
          const value = total ? (segment.value / total) * circumference : 0;
          const currentOffset = offset;
          offset += value;
          return (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="16"
              strokeDasharray={`${value} ${circumference - value}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <div className="report-donut-center">
        <strong>{centerValue}</strong>
        <span>{centerTitle}</span>
      </div>
    </div>
  );
}

function AreaChart({ points, color = "#7c3aed" }) {
  const values = points.map((point) => point.revenue);
  const path = makePath(values, 640, 220);
  const fillPath = path ? `${path} L 640 220 L 0 220 Z` : "";
  const max = Math.max(...values, 1);

  return (
    <div className="report-chart">
      <svg viewBox="0 0 640 220" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2="640" y1={line * 55} y2={line * 55} stroke="#eef2f7" />
        ))}
        <path d={fillPath} fill="url(#adminReportGradient)" opacity="0.75" />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="adminReportGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="report-chart-labels">
        {points.slice(0, 7).map((point) => (
          <span key={point.key}>{point.label}</span>
        ))}
      </div>
      <div className="report-chart-scale">
        <span>{fmtPrice(max)}</span>
        <span>{fmtPrice(Math.round(max / 2))}</span>
        <span>0 ₪</span>
      </div>
    </div>
  );
}

export default function SuperAdminStatisticsPage() {
  const { t } = useLanguage();
  const dayNames = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(dateInput(monthStart()));
  const [to, setTo] = useState(dateInput(new Date()));
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    adminApi.analytics({ from, to })
      .then((res) => mounted && setData(res))
      .catch(() => mounted && setData({ businesses: [], users: [], subscriptions: [], appointments: [] }))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [from, to]);

  const report = useMemo(() => {
    const appointments = data?.appointments || [];
    const businesses = data?.businesses || [];
    const users = data?.users || [];
    const subscriptions = data?.subscriptions || [];
    const activeBusinesses = businesses.filter((item) => item.isActive);
    const paidRows = appointments.filter((item) => item.status !== "CANCELLED" && isPaid(item) && !needsRefund(item));
    const revenue = sum(paidRows, amountOf);
    const subscriptionRevenue = sum(subscriptions.filter((item) => item.status === "ACTIVE"), (item) => Number(item.price || 0));
    const noShowRows = appointments.filter((item) => item.status === "NO_SHOW");
    const completedRows = appointments.filter((item) => item.status === "COMPLETED");
    const failedRows = appointments.filter((item) => item.status === "CANCELLED" || item.paymentStatus === "FAILED");
    const uniqueCustomers = new Set(appointments.map((item) => `${item.businessId}-${item.customerPhone}`).filter(Boolean)).size;

    const dayMap = new Map();
    appointments.forEach((appointment) => {
      const key = dateInput(new Date(appointment.startAt));
      const item = dayMap.get(key) || { key, label: compactDate(appointment.startAt), revenue: 0, count: 0 };
      item.count += 1;
      if (appointment.status !== "CANCELLED" && isPaid(appointment) && !needsRefund(appointment)) item.revenue += amountOf(appointment);
      dayMap.set(key, item);
    });
    const daily = [...dayMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const spark = daily.length ? daily.map((item) => item.revenue || item.count) : [1, 3, 2, 4, 3, 5, 4];

    const statusSegments = Object.entries(STATUS)
      .map(([key, meta]) => ({
        key,
        label: meta.label,
        color: meta.color,
        value: appointments.filter((item) => item.status === key).length,
      }))
      .filter((item) => item.value > 0);

    const businessMap = new Map();
    appointments.forEach((appointment) => {
      const id = appointment.business?.id || appointment.businessId;
      const item = businessMap.get(id) || {
        id,
        name: appointment.business?.name || t("stat.unknownBusiness"),
        revenue: 0,
        appointments: 0,
      };
      item.appointments += 1;
      if (appointment.status !== "CANCELLED" && isPaid(appointment) && !needsRefund(appointment)) item.revenue += amountOf(appointment);
      businessMap.set(id, item);
    });
    const topBusinesses = [...businessMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const topMax = Math.max(...topBusinesses.map((item) => item.revenue), 1);

    const peak = Array.from({ length: 7 }).map((_, dayIndex) => ({
      dayIndex,
      hours: HOURS.map((hour) => appointments.filter((appointment) => {
        const date = new Date(appointment.startAt);
        return date.getDay() === dayIndex && date.getHours() >= hour && date.getHours() < hour + 2;
      }).length),
    }));
    const peakMax = Math.max(...peak.flatMap((day) => day.hours), 1);

    const financialSummary = [
      [t("stat.totalRevenue"), fmtPrice(revenue)],
      [t("stat.subRevenue"), fmtPrice(subscriptionRevenue)],
      [t("stat.bookingRevenue"), fmtPrice(Math.max(revenue - subscriptionRevenue, 0))],
      [t("stat.avgBooking"), fmtPrice(Math.round(revenue / Math.max(paidRows.length, 1)))],
      [t("stat.topDay"), fmtPrice(Math.max(...daily.map((item) => item.revenue), 0))],
    ];

    const attendanceRate = pct(appointments.length - noShowRows.length - failedRows.length, appointments.length);
    const absenceRate = pct(noShowRows.length, appointments.length);

    return {
      businesses,
      users,
      appointments,
      revenue,
      activeBusinesses: activeBusinesses.length,
      uniqueCustomers,
      completed: completedRows.length,
      failed: failedRows.length,
      attendanceRate,
      absenceRate,
      daily,
      spark,
      statusSegments,
      financialSummary,
      topBusinesses,
      topMax,
      peak,
      peakMax,
      recent: appointments.slice(0, 7),
    };
  }, [data, t]);

  if (loading) return <Spinner page />;

  return (
    <div className="reports-page admin-reports-page" data-no-auto-translate="true">
      <div className="reports-header">
        <div>
          <div className="page-title">{t("stat.adminTitle")}</div>
          <div className="page-sub">{t("stat.adminSub")}</div>
        </div>
        <span className="reports-header-icon">⌁</span>
      </div>

      <div className="reports-toolbar admin-reports-toolbar">
        <Button variant="primary" size="sm" type="button">{t("stat.exportReport")}</Button>
        <Field>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{t("stat.allPeriod")}</option>
            <option value="active">{t("stat.activeBusinessesOpt")}</option>
            <option value="appointments">{t("stat.appointmentsOnly")}</option>
          </Select>
        </Field>
        <div className="reports-date-chip">{fmtDate(from)} - {fmtDate(to)}</div>
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>

      <div className="reports-kpi-grid admin-reports-kpi-grid">
        <KpiCard icon="₪" title={t("stat.totalRevenue")} value={fmtPrice(report.revenue)} change={`+18.6% ${t("stat.vsPrevious")}`} color="#22c55e" data={report.spark} />
        <KpiCard icon="▣" title={t("totalBusinesses")} value={fmtNumber(report.businesses.length)} change={t("stat.activeBusinessesCount", { count: fmtNumber(report.activeBusinesses) })} color="#3b82f6" data={report.spark.map((value) => value / 2)} />
        <KpiCard icon="◉" title={t("stat.totalUsers")} value={fmtNumber(report.users.length)} change={`+9.7% ${t("stat.vsPrevious")}`} color="#7c3aed" data={report.spark.map((value, index) => value + index)} />
        <KpiCard icon="▦" title={t("stat.totalAppointments")} value={fmtNumber(report.appointments.length)} change={`+14.3% ${t("stat.vsPrevious")}`} color="#f59e0b" data={report.spark.map((value) => value / 3)} />
        <KpiCard icon="✓" title={t("stat.completedAppointments")} value={fmtNumber(report.completed)} change={t("stat.pctOfTotal", { n: report.attendanceRate })} color="#22c55e" data={[2, 3, 2, 4, 3, 5]} />
        <KpiCard icon="×" title={t("stat.failedAppointments")} value={fmtNumber(report.failed)} change={t("stat.pctAbsence", { n: report.absenceRate })} color="#ef4444" data={[4, 3, 4, 2, 3, 1]} />
      </div>

      <div className="reports-main-grid admin-reports-main-grid">
        <div className="report-card report-card-wide">
          <div className="report-card-head">
            <div>
              <span>{t("stat.totalRevenue")}</span>
              <strong>{fmtPrice(report.revenue)}</strong>
            </div>
            <button className="btn btn-sm btn-ghost" type="button">{t("stat.byDay")}</button>
          </div>
          <AreaChart points={report.daily.length ? report.daily : [{ key: "0", label: t("stat.noData"), revenue: 0 }]} />
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.statusDistribution")}</div>
          <DonutChart total={report.appointments.length} segments={report.statusSegments} centerValue={fmtNumber(report.appointments.length)} centerTitle={t("stat.totalAppointments")} />
          <div className="report-legend">
            {report.statusSegments.map((item) => (
              <div key={item.key}><span style={{ background: item.color }} />{item.label}<b>{pct(item.value, report.appointments.length)}% ({fmtNumber(item.value)})</b></div>
            ))}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.financialSummary")}</div>
          <div className="report-overview">
            {report.financialSummary.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <div className="reports-secondary-grid admin-reports-secondary-grid">
        <div className="report-card">
          <div className="report-card-link">{t("stat.allBusinesses")}</div>
          <div className="report-card-title">{t("stat.top10Businesses")}</div>
          <div className="report-business-bars">
            {report.topBusinesses.map((business, index) => (
              <div className="report-business-row" key={business.id}>
                <span>{index + 1}</span>
                <strong>{business.name}</strong>
                <div className="report-progress-track">
                  <div style={{ width: `${pct(business.revenue, report.topMax)}%`, background: "#7c3aed" }} />
                </div>
                <b>{fmtPrice(business.revenue)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.peakTimes")}</div>
          <div className="report-heatmap">
            {report.peak.map((row) => (
              <div className="report-heat-row" key={row.dayIndex}>
                <span>{dayNames[row.dayIndex]}</span>
                {row.hours.map((value, index) => (
                  <i key={`${row.dayIndex}-${index}`} style={{ opacity: 0.12 + (value / report.peakMax) * 0.88 }} />
                ))}
              </div>
            ))}
            <div className="report-heat-axis">
              <b>{t("sd.today")}</b>
              {HOURS.map((hour) => <b key={hour}>{hour}:00</b>)}
            </div>
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.attendanceAbsence")}</div>
          <DonutChart
            total={100}
            centerValue={`${report.attendanceRate}%`}
            centerTitle={t("stat.attendanceRateLabel")}
            segments={[
              { label: t("stat.attendance"), value: report.attendanceRate, color: "#22c55e" },
              { label: t("stat.absence"), value: Math.max(100 - report.attendanceRate, 0), color: "#e5e7eb" },
            ]}
          />
          <div className="admin-attendance-split">
            <Badge tone="success">{t("stat.pctAttendance", { n: report.attendanceRate })}</Badge>
            <Badge tone="danger">{t("stat.pctAbsence", { n: report.absenceRate })}</Badge>
          </div>
        </div>
      </div>

      <div className="report-card mt-3">
        <div className="report-card-title">{t("stat.latestTransactions")}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("stat.id")}</th>
                <th>{t("business")}</th>
                <th>{t("service")}</th>
                <th>{t("stat.type")}</th>
                <th>{t("sd.amount")}</th>
                <th>{t("paymentMethod")}</th>
                <th>{t("date")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((appointment) => (
                <tr key={appointment.id}>
                  <td>#{appointment.id}</td>
                  <td>{appointment.business?.name || "-"}</td>
                  <td>{appointment.service?.name || "-"}</td>
                  <td>{appointment.paymentMethod === "ONLINE" ? t("payMethodOnline") : t("payMethodStore")}</td>
                  <td>{fmtPrice(amountOf(appointment))}</td>
                  <td>{appointment.paymentStatus === "PAID" ? t("payStatusPaid") : t("acct.pendingAmount")}</td>
                  <td>{fmtDate(appointment.startAt)} - {fmtTime(appointment.startAt)}</td>
                  <td><Badge tone={STATUS[appointment.status]?.tone || "muted"}>{STATUS[appointment.status]?.label || appointment.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
