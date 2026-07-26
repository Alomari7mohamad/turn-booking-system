import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Select, Spinner, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const DAYS = Array.from({ length: 7 });
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
  const { t } = useLanguage();
  const dayNames = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
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
      toast.success(t("wh.saved"));
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
    if (!startDate) return toast.error(t("wh.pickStart"));
    if (!finalEndDate) return toast.error(t("wh.pickEnd"));

    const startAt = `${startDate}T${start}:00`;
    const endAt = `${finalEndDate}T${end}:00`;
    if (new Date(endAt) <= new Date(startAt)) return toast.error(t("wh.endAfterStart"));

    try {
      await api.createBlockedTime({
        employeeId: blockForm.employeeId || null,
        startAt,
        endAt,
        reason: blockForm.reason,
      });
      toast.success(t("wh.blockAdded"));
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
      toast.success(t("wh.blockDeleted"));
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
          <div className="page-title">{t("navWorkingHours")}</div>
          <div className="page-sub">{t("wh.sub")}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🕐 {t("wh.weekly")}</h3>
          <Button onClick={saveWeek} loading={saving}>{t("wh.saveChanges")}</Button>
        </div>
        <div className="card-pad col" style={{ gap: 10 }}>
          {week.map((d) => (
            <div key={d.dayOfWeek} className="row" style={{ gap: 14, padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ width: 90, fontWeight: 700 }}>{dayNames[d.dayOfWeek]}</div>
              <label className="row" style={{ gap: 6, cursor: "pointer", width: 120 }}>
                <input type="checkbox" checked={!d.isClosed} onChange={(e) => updateDay(d.dayOfWeek, { isClosed: !e.target.checked })} />
                <span className={d.isClosed ? "soft" : ""}>{d.isClosed ? t("svc.closed") : t("wh.open")}</span>
              </label>
              <div className="row" style={{ gap: 8, opacity: d.isClosed ? 0.4 : 1, pointerEvents: d.isClosed ? "none" : "auto" }}>
                <input className="input" type="time" style={{ width: 130 }} value={d.startTime} onChange={(e) => updateDay(d.dayOfWeek, { startTime: e.target.value })} />
                <span className="soft">{t("svc.to")}</span>
                <input className="input" type="time" style={{ width: 130 }} value={d.endTime} onChange={(e) => updateDay(d.dayOfWeek, { endTime: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 8, opacity: d.isClosed ? 0.4 : 1, pointerEvents: d.isClosed ? "none" : "auto" }}>
                <span className="soft">{t("wh.break")}</span>
                <input className="input" type="time" style={{ width: 120 }} value={d.breakStartTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakStartTime: e.target.value })} />
                <span className="soft">{t("svc.to")}</span>
                <input className="input" type="time" style={{ width: 120 }} value={d.breakEndTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakEndTime: e.target.value })} />
                {(d.breakStartTime || d.breakEndTime) && (
                  <Button size="sm" variant="ghost" onClick={() => updateDay(d.dayOfWeek, { breakStartTime: "", breakEndTime: "" })}>{t("wh.clear")}</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">🚫 {t("wh.blockedTimes")}</h3>
          <Button variant="ghost" onClick={() => setModal(true)}>+ {t("wh.addBlock")}</Button>
        </div>
        {blocked.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("date")}</th><th>{t("wh.period")}</th><th>{t("wh.appliesTo")}</th><th>{t("wh.reason")}</th><th></th></tr></thead>
              <tbody>
                {blocked.map((b) => (
                  <tr key={b.id}>
                    <td>{formatBlockedDate(b)}</td>
                    <td>{fmtTime(b.startAt)} - {fmtTime(b.endAt)}</td>
                    <td>{b.employee?.name || t("wh.wholeBusiness")}</td>
                    <td className="muted">{b.reason || "—"}</td>
                    <td><Button size="sm" variant="danger" onClick={() => setConfirmDel(b.id)}>{t("delete")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🚫" title={t("wh.noBlocked")} hint={t("wh.noBlockedHint")} />
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={t("wh.blockPeriod")}
        footer={
          <>
            <Button form="block-form" type="submit">{t("save")}</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>{t("cancel")}</Button>
          </>
        }
      >
        <form id="block-form" onSubmit={addBlock} className="col" style={{ gap: 16 }}>
          <Field label={t("wh.appliesTo")}>
            <Select value={blockForm.employeeId} onChange={(e) => setBlockForm({ ...blockForm, employeeId: e.target.value })}>
              <option value="">{t("wh.wholeBusiness")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-2">
            <Field label={t("wh.startDate")}><Input type="date" value={blockForm.startDate} onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value, endDate: blockForm.endDate || e.target.value })} required /></Field>
            <Field label={t("wh.endDate")}><Input type="date" value={blockForm.endDate} min={blockForm.startDate || undefined} onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })} required /></Field>
          </div>
          <div className="grid grid-2">
            <Field label={t("sd.from")}><Input type="time" value={blockForm.start} onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })} /></Field>
            <Field label={t("svc.to")}><Input type="time" value={blockForm.end} onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })} /></Field>
          </div>
          <Field label={t("wh.reasonOptional")}><Input value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder={t("wh.reasonPlaceholder")} /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDel} title={t("wh.deleteTitle")} message={t("wh.deleteMsg")} confirmText={t("delete")} danger onConfirm={doDelete} onClose={() => setConfirmDel(null)} />
    </>
  );
}
