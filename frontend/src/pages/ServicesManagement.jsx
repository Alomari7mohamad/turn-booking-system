import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Textarea, Badge, Spinner, EmptyState, fmtPrice } from "../components/ui.jsx";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const defaultHours = () => DAYS.map((_, dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "17:00",
  isClosed: dayOfWeek === 5,
}));
const empty = { name: "", description: "", durationMinutes: 30, price: 0, hasServiceHours: false, serviceHours: defaultHours() };

function normalizeHours(hours = []) {
  return defaultHours().map((day) => {
    const saved = hours.find((item) => item.dayOfWeek === day.dayOfWeek);
    return saved ? {
      dayOfWeek: day.dayOfWeek,
      startTime: saved.startTime,
      endTime: saved.endTime,
      isClosed: saved.isClosed,
    } : day;
  });
}

export default function ServicesManagement() {
  const toast = useToast();
  const { api } = useBusinessManage();
  const [services, setServices] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () => api.listServices().then((r) => setServices(r.services));
  useEffect(() => { load(); }, [api]);

  const openCreate = () => { setEditing(null); setForm({ ...empty, serviceHours: defaultHours() }); setModal(true); };
  const openEdit = (s) => {
    const serviceHours = normalizeHours(s.workingHours || []);
    setEditing(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      durationMinutes: s.durationMinutes,
      price: s.price,
      hasServiceHours: Boolean(s.workingHours?.length),
      serviceHours,
    });
    setModal(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updateHour = (dayOfWeek, patch) => {
    setForm((current) => ({
      ...current,
      serviceHours: current.serviceHours.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        price: Number(form.price),
        serviceHours: form.hasServiceHours ? form.serviceHours : [],
      };
      if (editing) await api.updateService(editing, payload);
      else await api.createService(payload);
      toast.success(editing ? "تم تحديث الخدمة" : "تمت إضافة الخدمة");
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
      await api.deleteService(id);
      toast.success("تم حذف الخدمة");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!services) return <Spinner page />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">الخدمات</div>
          <div className="page-sub">حدد الخدمات ومدتها وسعرها وساعات الحجز الخاصة بها</div>
        </div>
        <Button onClick={openCreate}>+ خدمة جديدة</Button>
      </div>

      {services.length ? (
        <div className="grid grid-3">
          {services.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="row-between">
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                {!s.isActive && <Badge tone="muted">معطلة</Badge>}
              </div>
              {s.description && <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{s.description}</p>}
              <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
                <Badge tone="info">⏱ {s.durationMinutes} دقيقة</Badge>
                <Badge tone="success">{fmtPrice(s.price)}</Badge>
                {s.workingHours?.length ? <Badge tone="warning">ساعات خاصة</Badge> : null}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 16 }}>
                <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>تعديل</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(s.id)}>حذف</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="✂️" title="لا توجد خدمات بعد" hint="أضف أول خدمة يقدمها محلك" action={<Button onClick={openCreate}>+ خدمة جديدة</Button>} />
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "تعديل الخدمة" : "خدمة جديدة"}
        footer={
          <>
            <Button form="svc-form" type="submit" loading={saving}>حفظ</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>إلغاء</Button>
          </>
        }
      >
        <form id="svc-form" onSubmit={save} className="col" style={{ gap: 16 }}>
          <Field label="اسم الخدمة"><Input value={form.name} onChange={set("name")} required /></Field>
          <Field label="الوصف (اختياري)"><Textarea value={form.description} onChange={set("description")} /></Field>
          <div className="grid grid-2">
            <Field label="المدة (دقيقة)"><Input type="number" min="5" step="5" value={form.durationMinutes} onChange={set("durationMinutes")} required /></Field>
            <Field label="السعر (₪)"><Input type="number" min="0" value={form.price} onChange={set("price")} /></Field>
          </div>

          <label className="row" style={{ gap: 8, cursor: "pointer", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={form.hasServiceHours}
              onChange={(e) => setForm((current) => ({ ...current, hasServiceHours: e.target.checked }))}
            />
            تحديد ساعات حجز خاصة لهذه الخدمة
          </label>

          {form.hasServiceHours && (
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <div className="col" style={{ gap: 8 }}>
                {form.serviceHours.map((day) => (
                  <div key={day.dayOfWeek} className="row wrap" style={{ gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 90, fontWeight: 700 }}>{DAYS[day.dayOfWeek]}</div>
                    <label className="row" style={{ gap: 6, width: 110 }}>
                      <input type="checkbox" checked={!day.isClosed} onChange={(e) => updateHour(day.dayOfWeek, { isClosed: !e.target.checked })} />
                      <span className={day.isClosed ? "soft" : ""}>{day.isClosed ? "مغلق" : "متاح"}</span>
                    </label>
                    <div className="row" style={{ gap: 8, opacity: day.isClosed ? 0.45 : 1, pointerEvents: day.isClosed ? "none" : "auto" }}>
                      <Input type="time" value={day.startTime} onChange={(e) => updateHour(day.dayOfWeek, { startTime: e.target.value })} style={{ width: 125 }} />
                      <span className="soft">إلى</span>
                      <Input type="time" value={day.endTime} onChange={(e) => updateHour(day.dayOfWeek, { endTime: e.target.value })} style={{ width: 125 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="حذف الخدمة"
        message="سيتم حذف الخدمة. لا يمكن حذف خدمة مرتبطة بحجوزات سابقة."
        confirmText="حذف"
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </>
  );
}
