import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Select, Spinner, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DEFAULT_BLOCK_FORM = { employeeId: "", startDate: "", endDate: "", start: "00:00", end: "23:59", reason: "" };

// يبني جدول 7 أيام افتراضي مدموجًا مع المحفوظ
function buildWeek(saved) {
  return DAYS.map((_, dow) => {
    const found = saved.find((h) => h.dayOfWeek === dow);
    return found
      ? {
          dayOfWeek: dow,
          startTime: found.startTime,
          endTime: found.endTime,
          breakStartTime: found.breakStartTime || "",
          breakEndTime: found.breakEndTime || "",
          isClosed: found.isClosed,
        }
      : { dayOfWeek: dow, startTime: "09:00", endTime: "17:00", breakStartTime: "", breakEndTime: "", isClosed: dow === 5 };
  });
}


const sameDate = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const formatBlockedDate = (blockedTime) => (
  sameDate(blockedTime.startAt, blockedTime.endAt)
    ? fmtDate(blockedTime.startAt)
    : `${fmtDate(blockedTime.startAt)} - ${fmtDate(blockedTime.endAt)}`
);

export default function WorkingHoursSettings() {
  const toast = useToast();
  const { api } = useBusinessManage();
  const [week, setWeek] = useState(null);
  const [saving, setSaving] = useState(false);

  // الأوقات المغلقة
  const [blocked, setBlocked] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [blockForm, setBlockForm] = useState(DEFAULT_BLOCK_FORM);
  const [confirmDel, setConfirmDel] = useState(null);

  const loadBlocked = () => api.listBlockedTimes().then((r) => setBlocked(r.blockedTimes));
  useEffect(() => {
    api.getWorkingHours().then((r) => setWeek(buildWeek(r.workingHours)));
    api.listEmployees().then((r) => setEmployees(r.employees));
    loadBlocked();
  }, [api]);

  const updateDay = (dow, patch) =>
    setWeek((w) => w.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));

  const saveWeek = async () => {
    setSaving(true);
    try {
      await api.setWorkingHours(week);
      toast.success("تم حفظ ساعات العمل");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (e) => {
    e.preventDefault();
    const { startDate, endDate, start, end } = blockForm;
    const finalEndDate = endDate || startDate;
    if (!startDate) return toast.error("اختر تاريخ البداية");
    if (!finalEndDate) return toast.error("اختر تاريخ النهاية");

    const startAt = `${startDate}T${start}:00`;
    const endAt = `${finalEndDate}T${end}:00`;
    if (new Date(endAt) <= new Date(startAt)) return toast.error("وقت النهاية يجب أن يكون بعد وقت البداية");

    try {
      await api.createBlockedTime({
        employeeId: blockForm.employeeId || null,
        startAt,
        endAt,
        reason: blockForm.reason,
      });
      toast.success("تمت إضافة الإغلاق");
      setModal(false);
      setBlockForm(DEFAULT_BLOCK_FORM);
      loadBlocked();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    const id = confirmDel;
    setConfirmDel(null);
    try {
      await api.deleteBlockedTime(id);
      toast.success("تم حذف الإغلاق");
      loadBlocked();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!week) return <Spinner page />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">ساعات العمل</div>
          <div className="page-sub">حدّد دوام المحل الأسبوعي والأوقات المغلقة</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🕐 الدوام الأسبوعي</h3>
          <Button onClick={saveWeek} loading={saving}>حفظ التغييرات</Button>
        </div>
        <div className="card-pad col" style={{ gap: 10 }}>
          {week.map((d) => (
            <div key={d.dayOfWeek} className="row" style={{ gap: 14, padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ width: 90, fontWeight: 700 }}>{DAYS[d.dayOfWeek]}</div>
              <label className="row" style={{ gap: 6, cursor: "pointer", width: 120 }}>
                <input type="checkbox" checked={!d.isClosed} onChange={(e) => updateDay(d.dayOfWeek, { isClosed: !e.target.checked })} />
                <span className={d.isClosed ? "soft" : ""}>{d.isClosed ? "مغلق" : "مفتوح"}</span>
              </label>
              <div className="row" style={{ gap: 8, opacity: d.isClosed ? 0.4 : 1, pointerEvents: d.isClosed ? "none" : "auto" }}>
                <input className="input" type="time" style={{ width: 130 }} value={d.startTime} onChange={(e) => updateDay(d.dayOfWeek, { startTime: e.target.value })} />
                <span className="soft">إلى</span>
                <input className="input" type="time" style={{ width: 130 }} value={d.endTime} onChange={(e) => updateDay(d.dayOfWeek, { endTime: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 8, opacity: d.isClosed ? 0.4 : 1, pointerEvents: d.isClosed ? "none" : "auto" }}>
                <span className="soft">استراحة</span>
                <input className="input" type="time" style={{ width: 120 }} value={d.breakStartTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakStartTime: e.target.value })} />
                <span className="soft">إلى</span>
                <input className="input" type="time" style={{ width: 120 }} value={d.breakEndTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakEndTime: e.target.value })} />
                {(d.breakStartTime || d.breakEndTime) && (
                  <Button size="sm" variant="ghost" onClick={() => updateDay(d.dayOfWeek, { breakStartTime: "", breakEndTime: "" })}>مسح</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">🚫 الأوقات المغلقة (إجازات / مناسبات)</h3>
          <Button variant="ghost" onClick={() => setModal(true)}>+ إضافة إغلاق</Button>
        </div>
        {blocked.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>الفترة</th><th>يخص</th><th>السبب</th><th></th></tr></thead>
              <tbody>
                {blocked.map((b) => (
                  <tr key={b.id}>
                    <td>{formatBlockedDate(b)}</td>
                    <td>{fmtTime(b.startAt)} - {fmtTime(b.endAt)}</td>
                    <td>{b.employee?.name || "كل المحل"}</td>
                    <td className="muted">{b.reason || "—"}</td>
                    <td><Button size="sm" variant="danger" onClick={() => setConfirmDel(b.id)}>حذف</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🚫" title="لا توجد أوقات مغلقة" hint="أضف إغلاقًا ليوم أو فترة معيّنة" />
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="إغلاق فترة"
        footer={
          <>
            <Button form="block-form" type="submit">حفظ</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>إلغاء</Button>
          </>
        }
      >
        <form id="block-form" onSubmit={addBlock} className="col" style={{ gap: 16 }}>
          <Field label="يخص">
            <Select value={blockForm.employeeId} onChange={(e) => setBlockForm({ ...blockForm, employeeId: e.target.value })}>
              <option value="">كل المحل</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-2">
            <Field label="تاريخ البداية"><Input type="date" value={blockForm.startDate} onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value, endDate: blockForm.endDate || e.target.value })} required /></Field>
            <Field label="تاريخ النهاية"><Input type="date" value={blockForm.endDate} min={blockForm.startDate || undefined} onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })} required /></Field>
          </div>
          <div className="grid grid-2">
            <Field label="من"><Input type="time" value={blockForm.start} onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })} /></Field>
            <Field label="إلى"><Input type="time" value={blockForm.end} onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })} /></Field>
          </div>
          <Field label="السبب (اختياري)"><Input value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder="إجازة، صيانة..." /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDel} title="حذف الإغلاق" message="سيُتاح هذا الوقت للحجز مجددًا." confirmText="حذف" danger onConfirm={doDelete} onClose={() => setConfirmDel(null)} />
    </>
  );
}
