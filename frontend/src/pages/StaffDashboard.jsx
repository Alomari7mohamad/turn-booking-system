import { useEffect, useState, useCallback } from "react";
import { staffApi } from "../api/endpoints.js";
import { useToast } from "../components/Toast.jsx";
import { Button, Select, Spinner, Badge, EmptyState, fmtDate, fmtTime, fmtPrice, STATUS_META } from "../components/ui.jsx";

// الحالات التي يُسمح للموظف بضبطها
const STAFF_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function StaffDashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [range, setRange] = useState("today");

  const load = useCallback(() => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let params = {};
    if (range === "today") params = { from: iso(today), to: iso(today) };
    else if (range === "week") {
      const end = new Date(today); end.setDate(end.getDate() + 7);
      params = { from: iso(today), to: iso(end) };
    }
    setData(null);
    staffApi.appointments(params).then(setData);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try {
      await staffApi.updateStatus(id, status);
      toast.success("تم تحديث حالة الموعد");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayAppointments = data?.appointments?.filter((a) => new Date(a.startAt).toISOString().slice(0, 10) === todayKey) || [];
  const formatAppointmentDate = (appointment) => {
    const start = new Date(appointment.startAt);
    return `${start.toLocaleDateString("ar", { weekday: "long" })} ${fmtDate(appointment.startAt)} من ${fmtTime(appointment.startAt)} حتى ${fmtTime(appointment.endAt)}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">مواعيدي{data?.employee ? ` — ${data.employee.name}` : ""}</div>
          <div className="page-sub">المواعيد المسندة إليك فقط</div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={() => window.print()}>طباعة أدوار اليوم</Button>
          <div className="row" style={{ gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
            {[["today", "اليوم"], ["week", "الأسبوع"], ["all", "الكل"]].map(([k, l]) => (
              <button key={k} className={`btn btn-sm ${range === k ? "btn-primary" : "btn-ghost"}`} style={range === k ? {} : { border: "none", background: "transparent" }} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        {!data ? <Spinner page /> : data.appointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>الزبون</th><th>الخدمة</th><th>الموعد</th><th>الحالة</th><th>تحديث</th></tr>
              </thead>
              <tbody>
                {data.appointments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.customerName}<div className="soft" style={{ fontSize: 12 }}>{a.customerPhone}</div></td>
                    <td>{a.service?.name}</td>
                    <td>{fmtDate(a.startAt)}<div className="soft" style={{ fontSize: 12 }}>{fmtTime(a.startAt)}</div></td>
                    <td><Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge></td>
                    <td>
                      <Select value={STAFF_STATUSES.includes(a.status) ? a.status : ""} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
                        <option value="" disabled>اختر الحالة</option>
                        {STAFF_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="📅" title="لا مواعيد" hint="لا توجد مواعيد مسندة إليك في هذا النطاق" />
        )}
      </div>
      <div className="appointments-print-page" dir="rtl">
        <h1>جدول أدوار اليوم</h1>
        {todayAppointments.length ? todayAppointments.map((a) => (
          <div key={a.id} className="print-appointment">
            <div className="print-customer"><strong>{a.customerName}</strong><span>{a.customerPhone}</span></div>
            <div>موعد الحجز: {formatAppointmentDate(a)}</div>
            <div>نوع الحجز: {a.service?.name || "-"}</div>
            <div>المبلغ: {fmtPrice(a.paymentAmount ?? a.service?.price ?? 0)}</div>
          </div>
        )) : <div className="muted">لا توجد أدوار اليوم للطباعة</div>}
      </div>
    </>
  );
}
