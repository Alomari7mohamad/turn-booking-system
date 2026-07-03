import { useEffect, useState, useCallback } from "react";
import { staffApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Button, Select, Spinner, Badge, EmptyState, fmtDate, fmtTime, fmtPrice, STATUS_META } from "../components/ui.jsx";
import { buildReviewUrl, buildReviewWhatsappUrl } from "../reviewLinks.js";

const STAFF_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const SECRETARY_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function amountOf(appointment) {
  return Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
}

function isToday(appointment) {
  return new Date(appointment.startAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function StaffDashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const isSecretaryUser = user?.staffRole === "SECRETARY";
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [range, setRange] = useState("today");

  useEffect(() => {
    if (!isSecretaryUser) return;
    staffApi.employees()
      .then((res) => setEmployees(res.employees || []))
      .catch(() => setEmployees([]));
  }, [isSecretaryUser]);

  const load = useCallback(() => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let params = {};
    if (range === "today") params = { from: iso(today), to: iso(today) };
    else if (range === "week") {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      params = { from: iso(today), to: iso(end) };
    }
    if (isSecretaryUser) params.includePending = "true";
    if (isSecretaryUser && employeeId) params.employeeId = employeeId;
    setData(null);
    staffApi.appointments(params).then(setData).catch((err) => {
      toast.error(err.message);
      setData({ employee: null, appointments: [] });
    });
  }, [range, employeeId, isSecretaryUser, toast]);

  useEffect(() => { load(); }, [load]);

  const isSecretary = data?.employee?.role === "SECRETARY" || isSecretaryUser;
  const allowedStatuses = isSecretary ? SECRETARY_STATUSES : STAFF_STATUSES;
  const visibleAppointments = (data?.appointments || []).filter((appointment) => {
    if (!isSecretary) return true;
    return appointment.status === "PENDING" || new Date(appointment.startAt) >= new Date();
  });
  const todayAppointments = visibleAppointments.filter(isToday);

  const setStatus = async (id, status, message = "تم تحديث حالة الموعد") => {
    try {
      await staffApi.updateStatus(id, status);
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sendReviewLink = async (appointment) => {
    try {
      const result = await staffApi.createReviewLink(appointment.id);
      const url = buildReviewUrl(result.path || result.token);
      window.open(buildReviewWhatsappUrl(appointment.customerPhone, url, appointment.customerName), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const printToday = () => {
    if (!todayAppointments.length) {
      toast.error("لا توجد أدوار اليوم لطباعتها");
      return;
    }
    window.print();
  };

  const formatAppointmentDate = (appointment) => {
    const start = new Date(appointment.startAt);
    return `${start.toLocaleDateString("ar", { weekday: "long" })} ${fmtDate(appointment.startAt)} من ${fmtTime(appointment.startAt)} حتى ${fmtTime(appointment.endAt)}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">مواعيد{data?.employee ? ` - ${data.employee.name}` : ""}</div>
          <div className="page-sub">
            {isSecretary ? "عرض مواعيد المحل مع إمكانية قبول أو رفض الحجوزات المنتظرة" : "المواعيد المسندة إليك فقط"}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={printToday}>طباعة أدوار اليوم</Button>
          <div className="row" style={{ gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
            {[["today", "اليوم"], ["week", "الأسبوع"], ["all", "الكل"]].map(([k, l]) => (
              <button key={k} className={`btn btn-sm ${range === k ? "btn-primary" : "btn-ghost"}`} style={range === k ? {} : { border: "none", background: "transparent" }} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {isSecretary && (
        <div className="card card-pad mt-2">
          <div className="row wrap" style={{ gap: 10 }}>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ maxWidth: 280 }}>
              <option value="">كل العاملين</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </Select>
            <Button variant="ghost" onClick={load}>تحديث</Button>
          </div>
        </div>
      )}

      <div className="card mt-3">
        {!data ? <Spinner page /> : visibleAppointments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الزبون</th>
                  <th>الخدمة</th>
                  {isSecretary && <th>العامل</th>}
                  <th>الموعد</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppointments.map((a) => {
                  const amount = amountOf(a);
                  const isPending = a.status === "PENDING";
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.customerName}<div className="soft" style={{ fontSize: 12 }}>{a.customerPhone}</div></td>
                      <td>{a.service?.name}<div className="soft" style={{ fontSize: 12 }}>{amount === 0 ? "مجانية" : fmtPrice(amount)}</div></td>
                      {isSecretary && <td>{a.employee?.name || "-"}</td>}
                      <td>{fmtDate(a.startAt)}<div className="soft" style={{ fontSize: 12 }}>{fmtTime(a.startAt)}</div></td>
                      <td>
                        <div className="row wrap" style={{ gap: 8 }}>
                          <Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge>
                          {isSecretary && isPending && (
                            <>
                              <Button size="sm" onClick={() => setStatus(a.id, "CONFIRMED", "تم قبول الموعد")}>قبول</Button>
                              <Button size="sm" variant="danger" onClick={() => setStatus(a.id, "CANCELLED", "تم رفض الموعد")}>رفض</Button>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        {a.status === "COMPLETED" && user?.business?.reviewsEnabled && !a.review ? (
                          <Button size="sm" onClick={() => sendReviewLink(a)}>إرسال رابط التقييم</Button>
                        ) : a.paymentStatus === "PAID" || a.status === "COMPLETED" ? (
                          <Badge tone="success">الزبون حضر</Badge>
                        ) : isSecretary && isPending ? (
                          <span className="soft" style={{ fontSize: 13 }}>بانتظار قرار السكرتارية</span>
                        ) : (
                          <Select value={allowedStatuses.includes(a.status) ? a.status : ""} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
                            <option value="" disabled>اختر الحالة</option>
                            {allowedStatuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </Select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="" title="لا توجد مواعيد" hint="لا توجد مواعيد قادمة أو بانتظار التأكيد في هذا النطاق" />
        )}
      </div>

      <div className="appointments-print-page" dir="rtl">
        <h1>جدول أدوار اليوم</h1>
        {todayAppointments.map((a) => (
          <div key={a.id} className="print-appointment">
            <div className="print-customer"><strong>{a.customerName}</strong><span>{a.customerPhone}</span></div>
            <div>موعد الحجز: {formatAppointmentDate(a)}</div>
            {isSecretary && <div>العامل: {a.employee?.name || "-"}</div>}
            <div>نوع الحجز: {a.service?.name || "-"}</div>
            <div>المبلغ: {amountOf(a) === 0 ? "الخدمة مجانية" : fmtPrice(amountOf(a))}</div>
          </div>
        ))}
      </div>
    </>
  );
}
