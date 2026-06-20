import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Badge, Spinner, EmptyState } from "../components/ui.jsx";

const empty = { name: "", phone: "", title: "", serviceIds: [], loginEmail: "", loginPassword: "" };
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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
    setForm({ name: e.name, phone: e.phone || "", title: e.title || "", serviceIds: e.serviceIds || [], loginEmail: e.user?.email || "", loginPassword: e.loginPassword || "" });
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
      toast.success("تم حفظ ساعات عمل الموظف");
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
        await api.updateEmployee(editing, { name: form.name, phone: form.phone, title: form.title, serviceIds: form.serviceIds, loginEmail: form.loginEmail, loginPassword: form.loginPassword });
      } else {
        await api.createEmployee(form);
      }
      toast.success(editing ? "تم تحديث الموظف" : "تمت إضافة الموظف");
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
      toast.success("تم حذف الموظف");
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
          <div className="page-title">الموظفون</div>
          <div className="page-sub">أضف الموظفين وحدّد الخدمات التي يقدّمونها</div>
        </div>
        <Button onClick={openCreate}>➕ موظف جديد</Button>
      </div>

      {employees.length ? (
        <div className="grid grid-3">
          {employees.map((e) => (
            <div key={e.id} className="card card-pad">
              <div className="row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="soft" style={{ fontSize: 13 }}>{e.title || "موظف"}</div>
                </div>
              </div>
              {e.phone && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>📞 {e.phone}</div>}
              {e.user && <div style={{ marginTop: 8 }}><Badge tone="primary">🔑 لديه حساب دخول</Badge></div>}
              <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
                {e.serviceIds?.length ? e.serviceIds.map((id) => (
                  <span key={id} className="badge badge-muted">{serviceName(id) || "خدمة"}</span>
                )) : <span className="soft" style={{ fontSize: 13 }}>لا خدمات مسندة</span>}
              </div>
              <div className="employee-actions row wrap" style={{ gap: 8, marginTop: 16 }}>
                <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>✎ تعديل</Button>
                <Button size="sm" variant="ghost" onClick={() => openHours(e)}>ساعات العمل</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(e.id)}>حذف</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="👥" title="لا يوجد موظفون" hint="أضف موظفيك لتتمكّن من إسناد الحجوزات" action={<Button onClick={openCreate}>➕ موظف جديد</Button>} />
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "تعديل موظف" : "موظف جديد"}
        large
        footer={
          <>
            <Button form="emp-form" type="submit" loading={saving}>حفظ</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>إلغاء</Button>
          </>
        }
      >
        <form id="emp-form" onSubmit={save} className="col" style={{ gap: 16 }}>
          <div className="grid grid-2">
            <Field label="الاسم"><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label="المسمى الوظيفي"><Input value={form.title} onChange={set("title")} placeholder="مثال: مصفف شعر" /></Field>
            <Field label="الهاتف"><Input value={form.phone} onChange={set("phone")} /></Field>
          </div>

          <Field label="الخدمات التي يقدّمها">
            <div className="row wrap" style={{ gap: 8 }}>
              {services.length ? services.map((s) => (
                <button type="button" key={s.id} onClick={() => toggleService(s.id)}
                  className={`badge ${form.serviceIds.includes(s.id) ? "badge-primary" : "badge-muted"}`}
                  style={{ border: "none", cursor: "pointer", padding: "7px 13px" }}>
                  {form.serviceIds.includes(s.id) ? "✓ " : ""}{s.name}
                </button>
              )) : <span className="soft">أضف خدمات أولًا من صفحة الخدمات</span>}
            </div>
          </Field>
          <div style={{ fontWeight: 700, marginTop: 4 }}>حساب دخول العامل</div>
          <p className="help-text" style={{ marginTop: -8 }}>
            البريد وكلمة السر الخاصة بدخول العامل. كلمة السر القديمة لا تظهر إلا إذا كانت محفوظة بعد هذا التحديث.
          </p>
          <div className="grid grid-2">
            <Field label="بريد الدخول"><Input type="email" value={form.loginEmail} onChange={set("loginEmail")} /></Field>
            <Field label="كلمة المرور">
              <div className="password-input">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.loginPassword}
                  onChange={set("loginPassword")}
                  placeholder={editing && !form.loginPassword ? "غير محفوظة سابقًا" : ""}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
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
        title={`ساعات عمل ${hoursModal?.name || ""}`}
        large
        footer={
          <>
            <Button form="employee-hours-form" type="submit" loading={savingHours}>حفظ</Button>
            <Button variant="ghost" onClick={() => setHoursModal(null)}>إلغاء</Button>
          </>
        }
      >
        {!employeeHours ? (
          <Spinner />
        ) : (
          <form id="employee-hours-form" onSubmit={saveEmployeeHours} className="col" style={{ gap: 10 }}>
            <p className="help-text" style={{ margin: 0 }}>
              تظهر هنا فقط الأيام التي يعمل فيها المحل. وقت الاستراحة يحدد من صفحة ساعات عمل المحل فقط.
            </p>
            {employeeHours.map((day) => (
              <div
                key={day.dayOfWeek}
                className="row"
                style={{ gap: 14, padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}
              >
                <div style={{ width: 90, fontWeight: 700 }}>{DAYS[day.dayOfWeek]}</div>
                <label className="row" style={{ gap: 6, cursor: "pointer", width: 120 }}>
                  <input
                    type="checkbox"
                    checked={!day.isClosed}
                    onChange={(e) => updateHour(day.dayOfWeek, { isClosed: !e.target.checked })}
                  />
                  <span className={day.isClosed ? "soft" : ""}>{day.isClosed ? "مغلق" : "مفتوح"}</span>
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
                  <span className="soft">إلى</span>
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
        title="حذف الموظف"
        message="سيتم حذف الموظف وإسناداته. الحجوزات السابقة قد تمنع الحذف."
        confirmText="حذف"
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </>
  );
}
