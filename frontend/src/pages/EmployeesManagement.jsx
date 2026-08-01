import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Select, Badge, Spinner, EmptyState } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const empty = { name: "", phone: "", title: "", role: "PROVIDER", serviceIds: [], loginEmail: "", loginPassword: "" };
const DAYS = Array.from({ length: 7 });

function buildEmployeeWeek(saved = [], businessHours = []) {
  const businessOpenDays = businessHours.filter((h) => !h.isClosed);
  const sourceDays = businessOpenDays.length
    ? businessOpenDays.map((h) => h.dayOfWeek)
    : DAYS.map((_, dow) => dow).filter((dow) => dow !== 5);

  return sourceDays.map((dow) => {
    const found = saved.find((h) => h.dayOfWeek === dow);
    const businessDay = businessHours.find((h) => h.dayOfWeek === dow);
    return found
      ? {
          dayOfWeek: dow,
          startTime: found.startTime,
          endTime: found.endTime,
          isClosed: found.isClosed,
        }
      : {
          dayOfWeek: dow,
          startTime: businessDay?.startTime || "09:00",
          endTime: businessDay?.endTime || "17:00",
          isClosed: false,
        };
  });
}

export default function EmployeesManagement() {
  const toast = useToast();
  const { api } = useBusinessManage();
  const { t } = useLanguage();
  const dayNames = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
  const [employees, setEmployees] = useState(null);
  const [services, setServices] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [hoursModal, setHoursModal] = useState(null);
  const [employeeHours, setEmployeeHours] = useState(null);
  const [savingHours, setSavingHours] = useState(false);

  const load = () => api.listEmployees().then((r) => setEmployees(r.employees));
  useEffect(() => {
    load();
    api.listServices().then((r) => setServices(r.services));
  }, [api]);

  const openCreate = () => { setEditing(null); setForm(empty); setShowPassword(false); setModal(true); };
  const openEdit = (e) => {
    setEditing(e.id);
    setShowPassword(false);
    setForm({ name: e.name, phone: e.phone || "", title: e.title || "", role: e.role || "PROVIDER", serviceIds: e.serviceIds || [], loginEmail: e.user?.email || "", loginPassword: e.loginPassword || "" });
    setModal(true);
  };
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));
  const toggleService = (id) =>
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }));
  const updateHour = (dow, patch) =>
    setEmployeeHours((hours) => hours.map((day) => (day.dayOfWeek === dow ? { ...day, ...patch } : day)));

  const openHours = async (employee) => {
    setHoursModal(employee);
    setEmployeeHours(null);
    try {
      const [employeeResponse, businessResponse] = await Promise.all([
        api.getEmployeeWorkingHours(employee.id),
        api.getWorkingHours(),
      ]);
      setEmployeeHours(buildEmployeeWeek(employeeResponse.workingHours || [], businessResponse.workingHours || []));
    } catch (err) {
      toast.error(err.message);
      setEmployeeHours(buildEmployeeWeek());
    }
  };

  const saveEmployeeHours = async (e) => {
    e.preventDefault();
    if (!hoursModal || !employeeHours) return;
    setSavingHours(true);
    try {
      await api.setEmployeeWorkingHours(hoursModal.id, employeeHours);
      toast.success(t("emp.hoursSaved"));
      setHoursModal(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingHours(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateEmployee(editing, { name: form.name, phone: form.phone, title: form.title, role: form.role, serviceIds: form.serviceIds, loginEmail: form.loginEmail, loginPassword: form.loginPassword });
      } else {
        await api.createEmployee(form);
      }
      toast.success(editing ? t("emp.updated") : t("emp.added"));
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    const id = confirmDel;
    setConfirmDel(null);
    try {
      await api.deleteEmployee(id);
      toast.success(t("emp.deleted"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!employees) return <Spinner page />;

  const serviceName = (id) => services.find((s) => s.id === id)?.name;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("emp.title")}</div>
          <div className="page-sub">{t("emp.sub")}</div>
        </div>
        <Button onClick={openCreate}>+ {t("emp.newEmployee")}</Button>
      </div>

      {employees.length ? (
        <div className="employees-management-grid">
          {employees.map((e) => (
            <article key={e.id} className="employee-management-card">
              <header className="employee-management-head">
                <div className="employee-management-identity">
                  <strong>{e.name}</strong>
                  <span>{e.title || (e.role === "SECRETARY" ? t("emp.secretaryDept") : t("pb.serviceProvider"))}</span>
                </div>
                <div className="employee-management-status">
                  {e.role === "SECRETARY" && <Badge tone="success">{t("emp.secretaryDept")}</Badge>}
                  {e.user && <Badge tone="primary">{t("emp.hasLogin")}</Badge>}
                </div>
              </header>

              <div className="employee-management-content">
                {e.phone && (
                  <a className="employee-management-phone" href={`tel:${e.phone}`}>
                    <span>{t("phone")}</span>
                    <b>{e.phone}</b>
                  </a>
                )}

                <div className="employee-management-services">
                  <span className="employee-management-label">{t("navServices")}</span>
                  <div>
                    {e.serviceIds?.length ? e.serviceIds.map((id) => (
                      <span key={id} className="badge badge-muted">{serviceName(id) || t("emp.serviceFallback")}</span>
                    )) : <span className="employee-management-empty">{t("emp.noServicesAssigned")}</span>}
                  </div>
                </div>
              </div>

              <footer className="employee-management-actions employee-actions">
                <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>{t("edit")}</Button>
                <Button size="sm" variant="ghost" onClick={() => openHours(e)}>{t("navWorkingHours")}</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(e.id)}>{t("delete")}</Button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="👥" title={t("emp.noEmployees")} hint={t("emp.noEmployeesHint")} action={<Button onClick={openCreate}>➕ {t("emp.newEmployee")}</Button>} />
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t("emp.editEmployee") : t("emp.newEmployee")}
        large
        footer={
          <>
            <Button form="emp-form" type="submit" loading={saving}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>{t("cancel")}</Button>
          </>
        }
      >
        <form id="emp-form" onSubmit={save} className="col" style={{ gap: 16 }}>
          <div className="grid grid-2">
            <Field label={t("pb.name")}><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label={t("emp.jobTitle")}><Input value={form.title} onChange={set("title")} placeholder={t("emp.jobTitlePlaceholder")} /></Field>
            <Field label={t("emp.role")}>
              <Select value={form.role} onChange={set("role")}>
                <option value="PROVIDER">{t("pb.serviceProvider")}</option>
                <option value="SECRETARY">{t("emp.secretaryDept")}</option>
              </Select>
            </Field>
            <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
          </div>

          <Field label={t("emp.services")}>
            <div className="row wrap" style={{ gap: 8 }}>
              {services.length ? services.map((s) => (
                <button type="button" key={s.id} onClick={() => toggleService(s.id)}
                  className={`badge ${form.serviceIds.includes(s.id) ? "badge-primary" : "badge-muted"}`}
                  style={{ border: "none", cursor: "pointer", padding: "7px 13px" }}>
                  {form.serviceIds.includes(s.id) ? "✓ " : ""}{s.name}
                </button>
              )) : <span className="soft">{t("emp.addServicesFirst")}</span>}
            </div>
          </Field>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{form.role === "SECRETARY" ? t("emp.secretaryLogin") : t("emp.employeeLogin")}</div>
          <p className="help-text" style={{ marginTop: -8 }}>
            {form.role === "SECRETARY"
              ? t("emp.secretaryHelp")
              : t("emp.employeeHelp")}
          </p>
          <div className="grid grid-2">
            <Field label={t("emp.loginEmail")}><Input type="email" value={form.loginEmail} onChange={set("loginEmail")} /></Field>
            <Field label={t("password")}>
              <div className="password-input">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.loginPassword}
                  onChange={set("loginPassword")}
                  placeholder={editing && !form.loginPassword ? t("emp.notSavedBefore") : ""}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  title={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!hoursModal}
        onClose={() => setHoursModal(null)}
        title={t("emp.employeeHours", { name: hoursModal?.name || "" })}
        large
        footer={
          <>
            <Button form="employee-hours-form" type="submit" loading={savingHours}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setHoursModal(null)}>{t("cancel")}</Button>
          </>
        }
      >
        {!employeeHours ? (
          <Spinner />
        ) : (
          <form id="employee-hours-form" onSubmit={saveEmployeeHours} className="col" style={{ gap: 10 }}>
            <p className="help-text" style={{ margin: 0 }}>
              {t("emp.hoursHelp")}
            </p>
            {employeeHours.map((day) => (
              <div
                key={day.dayOfWeek}
                className="row"
                style={{ gap: 14, padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}
              >
                <div style={{ width: 90, fontWeight: 700 }}>{dayNames[day.dayOfWeek]}</div>
                <label className="row" style={{ gap: 6, cursor: "pointer", width: 120 }}>
                  <input
                    type="checkbox"
                    checked={!day.isClosed}
                    onChange={(e) => updateHour(day.dayOfWeek, { isClosed: !e.target.checked })}
                  />
                  <span className={day.isClosed ? "soft" : ""}>{day.isClosed ? t("svc.closed") : t("wh.open")}</span>
                </label>
                <div
                  className="row"
                  style={{ gap: 8, opacity: day.isClosed ? 0.4 : 1, pointerEvents: day.isClosed ? "none" : "auto" }}
                >
                  <input
                    className="input"
                    type="time"
                    style={{ width: 130 }}
                    value={day.startTime}
                    onChange={(e) => updateHour(day.dayOfWeek, { startTime: e.target.value })}
                  />
                  <span className="soft">{t("svc.to")}</span>
                  <input
                    className="input"
                    type="time"
                    style={{ width: 130 }}
                    value={day.endTime}
                    onChange={(e) => updateHour(day.dayOfWeek, { endTime: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title={t("emp.deleteTitle")}
        message={t("emp.deleteMsg")}
        confirmText={t("delete")}
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </>
  );
}
