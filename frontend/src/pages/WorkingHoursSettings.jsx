import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Select, Spinner, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const DAYS = Array.from({ length: 7 });
const DEFAULT_BLOCK_FORM = { employeeId: "", startDate: "", endDate: "", start: "00:00", end: "23:59", fullDay: false, reason: "" };

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
          breakEnabled: Boolean(found.breakStartTime || found.breakEndTime),
          isClosed: found.isClosed,
        }
      : { dayOfWeek: dow, startTime: "09:00", endTime: "17:00", breakStartTime: "", breakEndTime: "", breakEnabled: false, isClosed: dow === 5 };
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
      await api.setWorkingHours(week.map(({ breakEnabled, ...day }) => ({
        ...day,
        breakStartTime: breakEnabled ? day.breakStartTime : "",
        breakEndTime: breakEnabled ? day.breakEndTime : "",
      })));
      toast.success(t("wh.saved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (e) => {
    e.preventDefault();
    const { startDate, endDate, start, end, fullDay } = blockForm;
    const finalEndDate = endDate || startDate;
    if (!startDate) return toast.error(t("wh.pickStart"));
    if (!finalEndDate) return toast.error(t("wh.pickEnd"));

    const startAt = `${startDate}T${fullDay ? "00:00" : start}:00`;
    const endAt = `${finalEndDate}T${fullDay ? "23:59" : end}:00`;
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
        <Button onClick={saveWeek} loading={saving}>{t("wh.saveChanges")}</Button>
      </div>

      <section className="working-hours-section">
        <div className="working-hours-week">
          {week.map((d) => (
            <article key={d.dayOfWeek} className={`working-hours-day${d.isClosed ? " is-closed" : ""}`}>
              <header className="working-hours-day-head">
                <strong>{dayNames[d.dayOfWeek]}</strong>
                <div className="working-hours-day-controls">
                  {!d.isClosed && (
                    <label className="working-day-toggle working-break-toggle">
                      <input
                        type="checkbox"
                        checked={d.breakEnabled}
                        onChange={(e) => updateDay(d.dayOfWeek, {
                          breakEnabled: e.target.checked,
                          ...(!e.target.checked ? { breakStartTime: "", breakEndTime: "" } : {}),
                        })}
                      />
                      <span aria-hidden="true" />
                      <b>{t("wh.break")}</b>
                    </label>
                  )}
                  <label className="working-day-toggle">
                    <input type="checkbox" checked={!d.isClosed} onChange={(e) => updateDay(d.dayOfWeek, { isClosed: !e.target.checked })} />
                    <span aria-hidden="true" />
                    <b>{d.isClosed ? t("svc.closed") : t("wh.open")}</b>
                  </label>
                </div>
              </header>

              {!d.isClosed && (
                <div className="working-hours-day-body">
                  <div className="working-hours-time-row">
                    <span>{t("wh.workPeriod")}</span>
                    <div>
                      <input aria-label={`${dayNames[d.dayOfWeek]} ${t("sd.from")}`} className="input" type="time" value={d.startTime} onChange={(e) => updateDay(d.dayOfWeek, { startTime: e.target.value })} />
                      <small>{t("svc.to")}</small>
                      <input aria-label={`${dayNames[d.dayOfWeek]} ${t("svc.to")}`} className="input" type="time" value={d.endTime} onChange={(e) => updateDay(d.dayOfWeek, { endTime: e.target.value })} />
                    </div>
                  </div>

                  {d.breakEnabled && (
                    <div className="working-hours-time-row">
                      <span>
                        {t("wh.break")}
                        {(d.breakStartTime || d.breakEndTime) && (
                          <button type="button" className="working-hours-clear" onClick={() => updateDay(d.dayOfWeek, { breakStartTime: "", breakEndTime: "" })}>
                            {t("wh.clear")}
                          </button>
                        )}
                      </span>
                      <div>
                        <input aria-label={`${dayNames[d.dayOfWeek]} ${t("wh.break")} ${t("sd.from")}`} className="input" type="time" value={d.breakStartTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakStartTime: e.target.value })} />
                        <small>{t("svc.to")}</small>
                        <input aria-label={`${dayNames[d.dayOfWeek]} ${t("wh.break")} ${t("svc.to")}`} className="input" type="time" value={d.breakEndTime || ""} onChange={(e) => updateDay(d.dayOfWeek, { breakEndTime: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="working-hours-blocked mt-3">
        <div className="working-hours-toolbar">
          <h3>{t("wh.blockedTimes")}</h3>
          <Button variant="ghost" onClick={() => setModal(true)}>+ {t("wh.addBlock")}</Button>
        </div>
        {blocked.length ? (
          <div className="working-hours-blocked-grid">
            {blocked.map((b) => (
              <article className="working-hours-blocked-card" key={b.id}>
                <header>
                  <strong>{formatBlockedDate(b)}</strong>
                  <span>{b.employee?.name || t("wh.wholeBusiness")}</span>
                </header>
                <div>
                  <span>{t("wh.period")}</span>
                  <strong>{fmtTime(b.startAt)} - {fmtTime(b.endAt)}</strong>
                </div>
                <div>
                  <span>{t("wh.reason")}</span>
                  <strong>{b.reason || "—"}</strong>
                </div>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(b.id)}>{t("delete")}</Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={t("wh.noBlocked")} hint={t("wh.noBlockedHint")} />
        )}
      </section>

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
          <label className="working-day-toggle block-full-day-toggle">
            <input type="checkbox" checked={blockForm.fullDay} onChange={(e) => setBlockForm({ ...blockForm, fullDay: e.target.checked })} />
            <span aria-hidden="true" />
            <b>{t("wh.fullDay")}</b>
          </label>
          {!blockForm.fullDay && (
            <div className="grid grid-2">
              <Field label={t("sd.from")}><Input type="time" value={blockForm.start} onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })} /></Field>
              <Field label={t("svc.to")}><Input type="time" value={blockForm.end} onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })} /></Field>
            </div>
          )}
          <Field label={t("wh.reasonOptional")}><Input value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder={t("wh.reasonPlaceholder")} /></Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDel} title={t("wh.deleteTitle")} message={t("wh.deleteMsg")} confirmText={t("delete")} danger onConfirm={doDelete} onClose={() => setConfirmDel(null)} />
    </>
  );
}
