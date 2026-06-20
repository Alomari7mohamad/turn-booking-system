import { useEffect, useState, useCallback } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
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

function rangeFor(kind) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
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
  return items.filter((item) => item.status === "CONFIRMED");
}

export default function AppointmentsPage({ mode = "bookings" }) {
  const toast = useToast();
  const { api, isAdminManaging } = useBusinessManage();
  const [appointments, setAppointments] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [range, setRange] = useState("week");
  const [employeeId, setEmployeeId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [lateTarget, setLateTarget] = useState(null);
  const [lateMinutes, setLateMinutes] = useState(10);
  const [lateSaving, setLateSaving] = useState(false);

  const load = useCallback(() => {
    const params = { ...rangeFor(range) };
    if (employeeId) params.employeeId = employeeId;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    setAppointments(null);
    api.listAppointments(params).then((r) => setAppointments(r.appointments));
  }, [api, range, employeeId, paymentStatus]);

  useEffect(() => { api.listEmployees().then((r) => setEmployees(r.employees)); }, [api]);
  useEffect(() => { load(); }, [load]);

  const visibleAppointments = appointments ? filterByMode(appointments, mode) : null;
  const pageTitle = mode === "rejected" ? "الحجوزات التي تم رفضها" : "الحجوزات";
  const pageSub = mode === "rejected" ? "كل الأدوار التي رفضها صاحب المحل" : "الأدوار المؤكدة والمقبولة فقط";

  const changeStatus = async (id, newStatus, successMessage = "تم تحديث الحالة") => {
    try {
      await api.updateAppointment(id, { status: newStatus });
      toast.success(successMessage);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changePayment = async (id, ps) => {
    try {
      await api.updateAppointmentPayment(id, ps);
      toast.success("تم تحديث حالة الدفع");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAction = (appointment, action) => {
    if (!action) return;
    if (action === "NO_SHOW") {
      changeStatus(appointment.id, "NO_SHOW", "تم تسجيل الزبون: لم يحضر");
      return;
    }
    if (action === "LATE") {
      setLateTarget(appointment);
      setLateMinutes(10);
    }
  };

  const submitDelay = async (e) => {
    e.preventDefault();
    const minutes = Number(lateMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      toast.error("اكتب وقت التأخير بالدقائق");
      return;
    }

    setLateSaving(true);
    try {
      const result = await api.delayAppointment(lateTarget.id, minutes);
      toast.success(`تم تأخير ${result.appointments?.length || 1} حجز`);
      setLateTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLateSaving(false);
    }
  };

  const formatAppointmentDate = (appointment) => {
    const start = new Date(appointment.startAt);
    return `${start.toLocaleDateString("ar", { weekday: "long" })} ${fmtDate(appointment.startAt)} من ${fmtTime(appointment.startAt)} حتى ${fmtTime(appointment.endAt)}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{pageTitle}</div>
          <div className="page-sub">{pageSub}</div>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>طباعة جدول الأدوار</Button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap appointments-filters" style={{ gap: 10 }}>
          <div className="row appointments-range-filter" style={{ gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
            {[["today", "اليوم"], ["week", "الأسبوع"], ["all", "الكل"]].map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${range === key ? "btn-primary" : "btn-ghost"}`} style={range === key ? {} : { border: "none", background: "transparent" }} onClick={() => setRange(key)}>{label}</button>
            ))}
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 180 }}>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">كل الموظفين</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
          </div>
          <div className="appointments-filter-select" style={{ minWidth: 160 }}>
            <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">كل حالات الدفع</option>
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
                  <th>الزبون</th>
                  <th>الخدمة</th>
                  <th>الموظف</th>
                  <th>الموعد</th>
                  <th>الحالة</th>
                  <th>الدفع</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppointments.map((appointment) => {
                  const paidLocked = appointment.paymentStatus === "PAID";
                  const amount = Number(appointment.paymentAmount ?? appointment.service?.price ?? 0);
                  const isFree = amount === 0;
                  return (
                    <tr key={appointment.id}>
                      <td style={{ fontWeight: 600 }}>{appointment.customerName}<div className="soft" style={{ fontSize: 12 }}>{appointment.customerPhone}</div></td>
                      <td>{appointment.service?.name}<div className="soft" style={{ fontSize: 12 }}>{isFree ? "الخدمة مجانية" : fmtPrice(amount)}</div></td>
                      <td>{appointment.employee?.name}</td>
                      <td>{fmtDate(appointment.startAt)}<div className="soft" style={{ fontSize: 12 }}>{fmtTime(appointment.startAt)} - {fmtTime(appointment.endAt)}</div></td>
                      <td><Badge tone={STATUS_META[appointment.status]?.tone}>{STATUS_META[appointment.status]?.label}</Badge></td>
                      <td>
                        <div className="soft" style={{ fontSize: 12, marginBottom: 4 }}>
                          {isFree ? "بدون دفع" : appointment.paymentMethod ? PAYMENT_METHOD_META[appointment.paymentMethod]?.label : "-"}
                          {!isFree && appointment.paymentAmount ? ` - ${fmtPrice(appointment.paymentAmount)}` : ""}
                        </div>
                        {isFree ? (
                          <Badge tone="success">الخدمة مجانية</Badge>
                        ) : !paidLocked && (appointment.paymentMethod === "PAY_AT_STORE" || isAdminManaging) ? (
                          <Select value={appointment.paymentStatus} onChange={(e) => changePayment(appointment.id, e.target.value)} style={{ width: "auto", padding: "5px 8px", fontSize: 12.5 }}>
                            {Object.entries(PAYMENT_STATUS_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                          </Select>
                        ) : (
                          <Badge tone={PAYMENT_STATUS_META[appointment.paymentStatus]?.tone}>{PAYMENT_STATUS_META[appointment.paymentStatus]?.label}</Badge>
                        )}
                      </td>
                      <td>
                        {mode === "bookings" ? (
                          <Select value="" onChange={(e) => handleAction(appointment, e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
                            <option value="">اختر إجراء</option>
                            <option value="LATE">تأخر</option>
                            <option value="NO_SHOW">لم يحضر</option>
                          </Select>
                        ) : <span className="soft">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="لا توجد حجوزات" hint="جرب تغيير الفلاتر أو النطاق الزمني" />
        )}
      </div>

      <div className="appointments-print-page" dir="rtl">
        <h1>جدول الأدوار</h1>
        {visibleAppointments?.length ? visibleAppointments.map((appointment) => (
          <div key={appointment.id} className="print-appointment">
            <div className="print-customer"><strong>{appointment.customerName}</strong><span>{appointment.customerPhone}</span></div>
            <div>موعد الحجز: {formatAppointmentDate(appointment)}</div>
            <div>نوع الحجز: {appointment.service?.name || "-"}</div>
            <div>المبلغ: {Number(appointment.paymentAmount ?? appointment.service?.price ?? 0) === 0 ? "الخدمة مجانية" : fmtPrice(appointment.paymentAmount ?? appointment.service?.price ?? 0)}</div>
          </div>
        )) : <div className="muted">لا توجد حجوزات للطباعة</div>}
      </div>

      <Modal open={!!lateTarget} onClose={() => setLateTarget(null)} title="تأخير الدور" footer={<><Button form="late-form" type="submit" loading={lateSaving}>تأكيد التأخير</Button><Button variant="ghost" onClick={() => setLateTarget(null)}>إلغاء</Button></>}>
        <form id="late-form" onSubmit={submitDelay} className="col" style={{ gap: 14 }}>
          <div className="soft">سيتم إضافة وقت التأخير إلى هذا الدور وكل الأدوار التالية لنفس الموظف.</div>
          <Field label="وقت التأخير بالدقائق"><Input type="number" min="1" step="1" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} autoFocus /></Field>
        </form>
      </Modal>
    </>
  );
}
