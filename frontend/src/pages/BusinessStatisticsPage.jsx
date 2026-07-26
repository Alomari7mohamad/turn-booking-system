import { useEffect, useMemo, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Badge, Field, Input, Select, Spinner, fmtDate, fmtNumber, fmtPrice, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";
import { localeFor } from "../i18n/format.js";

const PERIODS = [
  { key: "month", labelKey: "stat.month" },
  { key: "today", labelKey: "sd.today" },
  { key: "week", labelKey: "stat.last7" },
  { key: "year", labelKey: "stat.thisYear" },
  { key: "all", labelKey: "stat.allPeriod" },
  { key: "custom", labelKey: "stat.customDate" },
];

const STATUS = {
  COMPLETED: { get label() { return i18n.t("stat.completed"); }, color: "#22c55e", tone: "success" },
  CONFIRMED: { get label() { return i18n.t("stat.confirmed"); }, color: "#3b82f6", tone: "info" },
  PENDING: { get label() { return i18n.t("stat.pending"); }, color: "#f59e0b", tone: "warning" },
  CANCELLED: { get label() { return i18n.t("stat.cancelled"); }, color: "#ef4444", tone: "danger" },
  NO_SHOW: { get label() { return i18n.t("statusNoShow"); }, color: "#94a3b8", tone: "muted" },
};

const PAYMENT_COLORS = ["#22c55e", "#3b82f6", "#7c3aed", "#f59e0b"];
const HOURS = [8, 10, 12, 14, 16, 18, 20];

function dateInput(date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function periodRange(period, from, to) {
  const now = new Date();
  const today = startOfToday();
  if (period === "today") return { from: today, to: new Date(`${dateInput(today)}T23:59:59.999`) };
  if (period === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: start, to: now };
  }
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (period === "year") return { from: new Date(now.getFullYear(), 0, 1), to: now };
  if (period === "custom") {
    return {
      from: from ? new Date(`${from}T00:00:00`) : null,
      to: to ? new Date(`${to}T23:59:59.999`) : null,
    };
  }
  return { from: null, to: null };
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

function paymentDateOf(appointment) {
  return new Date(appointment.paidAt || appointment.startAt);
}

function inRange(date, range) {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function pct(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
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

function sum(items, getValue) {
  return items.reduce((total, item) => total + getValue(item), 0);
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

function AreaChart({ points }) {
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
        <path d={fillPath} fill="url(#reportGradient)" opacity="0.7" />
        <path d={path} fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="reportGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="report-chart-labels">
        {points.slice(0, 6).map((point) => (
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

function MiniProgress({ label, sub, value, color = "#22c55e" }) {
  return (
    <div className="report-progress-row">
      <div>
        <strong>{label}</strong>
        <span>{sub}</span>
      </div>
      <b>{value}%</b>
      <div className="report-progress-track">
        <div style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function BusinessStatisticsPage() {
  const { api } = useBusinessManage();
  const { t } = useLanguage();
  const dayNames = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState(dateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(dateInput(new Date()));

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.listAppointments(),
      api.listEmployees().catch(() => ({ employees: [] })),
    ])
      .then(([appointmentsRes, employeesRes]) => {
        if (!mounted) return;
        setAppointments(appointmentsRes.appointments || []);
        setEmployees(employeesRes.employees || []);
      })
      .catch((err) => {
        toast.error(err.message);
        setAppointments([]);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [api, toast]);

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const report = useMemo(() => {
    const rows = appointments.filter((appointment) => {
      const date = new Date(appointment.startAt);
      return inRange(date, range);
    });

    const financialRows = rows.filter((item) => item.status !== "CANCELLED");
    const paidRows = appointments.filter((item) =>
      item.status !== "CANCELLED" &&
      isPaid(item) &&
      !needsRefund(item) &&
      inRange(paymentDateOf(item), range)
    );
    const revenue = sum(paidRows, amountOf);
    const unpaid = sum(financialRows.filter((item) => !isPaid(item) && item.status !== "NO_SHOW"), amountOf);
    const refund = sum(appointments.filter((item) => needsRefund(item) && inRange(paymentDateOf(item), range)), amountOf);
    const attendanceBase = rows.filter((item) => item.status !== "CANCELLED");
    const noShow = rows.filter((item) => item.status === "NO_SHOW").length;
    const attendance = Math.max(0, attendanceBase.length - noShow);
    const activeEmployees = new Set(rows.map((item) => item.employee?.name).filter(Boolean)).size;
    const averageRating = 4.8;

    const dayMap = new Map();
    rows.forEach((appointment) => {
      const key = dateInput(new Date(appointment.startAt));
      const item = dayMap.get(key) || { key, label: compactDate(appointment.startAt), revenue: 0, count: 0 };
      item.count += 1;
      dayMap.set(key, item);
    });
    paidRows.forEach((appointment) => {
      const paymentDate = paymentDateOf(appointment);
      const key = dateInput(paymentDate);
      const item = dayMap.get(key) || { key, label: compactDate(paymentDate), revenue: 0, count: 0 };
      item.revenue += amountOf(appointment);
      dayMap.set(key, item);
    });
    const daily = [...dayMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const spark = daily.length ? daily.map((item) => item.revenue || item.count) : [0, 1, 0, 2, 1, 3];

    const statusSegments = Object.entries(STATUS).map(([key, meta]) => ({
      label: meta.label,
      color: meta.color,
      value: rows.filter((item) => item.status === key).length,
      key,
    })).filter((item) => item.value > 0);

    const paymentMap = [
      { label: t("stat.cash"), value: sum(paidRows.filter((item) => item.paymentMethod === "PAY_AT_STORE"), amountOf), color: PAYMENT_COLORS[0] },
      { label: t("stat.creditCard"), value: sum(paidRows.filter((item) => item.paymentMethod === "ONLINE"), amountOf), color: PAYMENT_COLORS[1] },
      { label: t("stat.bankTransfer"), value: 0, color: PAYMENT_COLORS[2] },
      { label: t("stat.eWallet"), value: 0, color: PAYMENT_COLORS[3] },
    ].filter((item) => item.value > 0);

    const employeeMap = new Map();
    rows.forEach((appointment) => {
      const name = appointment.employee?.name || t("stat.unspecified");
      const item = employeeMap.get(name) || { name, total: 0, attended: 0, revenue: 0 };
      item.total += 1;
      if (appointment.status !== "NO_SHOW" && appointment.status !== "CANCELLED") item.attended += 1;
      employeeMap.set(name, item);
    });
    paidRows.forEach((appointment) => {
      const name = appointment.employee?.name || t("stat.unspecified");
      const item = employeeMap.get(name) || { name, total: 0, attended: 0, revenue: 0 };
      item.revenue += amountOf(appointment);
      employeeMap.set(name, item);
    });
    const employeeRows = [...employeeMap.values()]
      .map((item) => ({ ...item, attendance: pct(item.attended, item.total) }))
      .sort((a, b) => b.attendance - a.attendance)
      .slice(0, 5);

    const peak = Array.from({ length: 7 }).map((_, dayIndex) => ({
      dayIndex,
      hours: HOURS.map((hour) => rows.filter((appointment) => {
        const date = new Date(appointment.startAt);
        return date.getDay() === dayIndex && date.getHours() >= hour && date.getHours() < hour + 2;
      }).length),
    }));
    const peakMax = Math.max(...peak.flatMap((day) => day.hours), 1);

    const overview = [
      [t("stat.totalCustomers"), new Set(rows.map((item) => item.customerPhone).filter(Boolean)).size],
      [t("stat.totalAppointments"), rows.length],
      [t("stat.cancelRate"), `${pct(rows.filter((item) => item.status === "CANCELLED").length, rows.length)}%`],
      [t("stat.avgOrderValue"), fmtPrice(Math.round(revenue / Math.max(paidRows.length, 1)))],
      [t("stat.totalServices"), new Set(rows.map((item) => item.service?.name).filter(Boolean)).size],
      [t("stat.totalStaff"), activeEmployees],
    ];

    return {
      rows,
      revenue,
      unpaid,
      refund,
      attendanceRate: pct(attendance, attendanceBase.length),
      appointmentsCount: rows.length,
      activeEmployees,
      averageRating,
      daily,
      spark,
      statusSegments,
      paymentMap,
      employeeRows,
      peak,
      peakMax,
      overview,
      recent: rows.slice().sort((a, b) => new Date(b.startAt) - new Date(a.startAt)).slice(0, 6),
    };
  }, [appointments, range, t]);

  if (loading) return <Spinner page />;

  const displayFrom = range.from ? fmtDate(range.from) : t("stat.beginning");
  const displayTo = range.to ? fmtDate(range.to) : t("sd.today");

  return (
    <div className="reports-page" data-no-auto-translate="true">
      <div className="reports-header">
        <div>
          <div className="page-title">{t("stat.title")}</div>
          <div className="page-sub">{t("stat.sub")}</div>
        </div>
        <span className="reports-header-icon">⌁</span>
      </div>

      <div className="reports-toolbar">
        <div className="reports-date-chip">{displayFrom} - {displayTo}</div>
        <Field>
          <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIODS.map((item) => <option key={item.key} value={item.key}>{t(item.labelKey)}</option>)}
          </Select>
        </Field>
        {period === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </>
        )}
      </div>

      <div className="reports-kpi-grid">
        <KpiCard icon="◌" title={t("stat.totalProfit")} value={fmtPrice(report.revenue)} change={`+12.5% ${t("stat.vsPrevious")}`} color="#22c55e" data={report.spark} />
        <KpiCard icon="▣" title={t("stat.totalAppointments")} value={fmtNumber(report.appointmentsCount)} change={`+8.3% ${t("stat.vsPrevious")}`} color="#7c3aed" data={report.spark.map((v) => v / 2)} />
        <KpiCard icon="♙" title={t("stat.newCustomers")} value={fmtNumber(new Set(report.rows.map((item) => item.customerPhone)).size)} change={`+15.7% ${t("stat.vsPrevious")}`} color="#3b82f6" data={report.spark.map((v, i) => v + i)} />
        <KpiCard icon="☆" title={t("stat.avgRating")} value={`${report.averageRating} ★`} change={`+0.3 ${t("stat.vsPrevious")}`} color="#f59e0b" data={[1, 2, 1, 3, 2, 4]} />
        <KpiCard icon="♂" title={t("stat.attendanceRate")} value={`${report.attendanceRate}%`} change={`+5% ${t("stat.vsPrevious")}`} color="#22c55e" data={[2, 1, 2, 1, 3, 2, 4]} />
      </div>

      <div className="reports-main-grid">
        <div className="report-card report-card-wide">
          <div className="report-card-head">
            <div>
              <span>{t("stat.totalRevenue")}</span>
              <strong>{fmtPrice(report.revenue)}</strong>
            </div>
            <button className="btn btn-sm btn-ghost">{t("stat.byDay")}</button>
          </div>
          <AreaChart points={report.daily.length ? report.daily : [{ key: "0", label: t("stat.noData"), revenue: 0 }]} />
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.appointmentsByStatus")}</div>
          <DonutChart total={report.appointmentsCount} segments={report.statusSegments} centerValue={fmtNumber(report.appointmentsCount)} centerTitle={t("stat.totalAppointments")} />
          <div className="report-legend">
            {report.statusSegments.map((item) => (
              <div key={item.key}><span style={{ background: item.color }} />{item.label}<b>{pct(item.value, report.appointmentsCount)}% ({item.value})</b></div>
            ))}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.overview")}</div>
          <div className="report-overview">
            {report.overview.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <div className="reports-secondary-grid">
        <div className="report-card">
          <div className="report-card-link">{t("viewAll")}</div>
          <div className="report-card-title">{t("stat.payments")}</div>
          <DonutChart total={report.revenue || 1} segments={report.paymentMap} centerValue={fmtPrice(report.revenue)} centerTitle={t("stat.totalPayments")} />
          <div className="report-legend">
            {report.paymentMap.map((item) => (
              <div key={item.label}><span style={{ background: item.color }} />{item.label}<b>{fmtPrice(item.value)}</b></div>
            ))}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-link">{t("viewAll")}</div>
          <div className="report-card-title">{t("stat.staffAttendance")}</div>
          <div className="report-staff-list">
            {(report.employeeRows.length ? report.employeeRows : employees.slice(0, 5).map((employee) => ({ name: employee.name, total: 0, attended: 0, attendance: 0 }))).map((employee, index) => (
              <MiniProgress
                key={employee.name}
                label={employee.name}
                sub={`${employee.attended || 0}/${employee.total || 0}`}
                value={employee.attendance || 0}
                color={index < 3 ? "#22c55e" : "#f59e0b"}
              />
            ))}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-title">{t("stat.peakTimes")}</div>
          <div className="report-heatmap">
            {report.peak.map((row) => (
              <div key={row.dayIndex} className="report-heat-row">
                <span>{dayNames[row.dayIndex]}</span>
                {row.hours.map((value, index) => (
                  <i key={index} style={{ opacity: 0.16 + (value / report.peakMax) * 0.84 }} />
                ))}
              </div>
            ))}
            <div className="report-heat-axis">
              <span />
              {HOURS.map((hour) => <b key={hour}>{hour}:00</b>)}
            </div>
          </div>
        </div>
      </div>

      <div className="report-card mt-3">
        <div className="report-card-head">
          <div className="report-card-title">{t("stat.recentTransactions")}</div>
          <button className="btn btn-sm btn-ghost">{t("viewAll")}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("stat.id")}</th>
                <th>{t("stat.client")}</th>
                <th>{t("service")}</th>
                <th>{t("stat.amountCol")}</th>
                <th>{t("date")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((appointment) => (
                <tr key={appointment.id}>
                  <td>#{appointment.id}</td>
                  <td>{appointment.customerName}</td>
                  <td>{appointment.service?.name || "-"}</td>
                  <td>{amountOf(appointment) === 0 ? t("pb.free") : fmtPrice(amountOf(appointment))}</td>
                  <td>{fmtDate(appointment.startAt)} - {fmtTime(appointment.startAt)}</td>
                  <td><Badge tone={STATUS[appointment.status]?.tone}>{STATUS[appointment.status]?.label || appointment.status}</Badge></td>
                </tr>
              ))}
              {!report.recent.length && (
                <tr><td colSpan="6" className="soft" style={{ textAlign: "center", padding: 22 }}>{t("stat.noTransactions")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
