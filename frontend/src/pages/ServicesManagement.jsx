import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { Button, Field, Input, Textarea, Badge, Spinner, EmptyState, fmtPrice } from "../components/ui.jsx";
import { LogoPicker } from "../components/LogoPicker.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const DAYS = Array.from({ length: 7 });

function defaultHours(businessHours = []) {
  return DAYS.map((_, dayOfWeek) => {
    const businessDay = businessHours.find((item) => item.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      startTime: businessDay?.startTime || "09:00",
      endTime: businessDay?.endTime || "17:00",
      isClosed: businessDay ? businessDay.isClosed : dayOfWeek === 5,
    };
  });
}

function emptyForm(businessHours = []) {
  return {
    name: "",
    description: "",
    imageUrl: "",
    durationMinutes: 30,
    price: 0,
    hasServiceHours: false,
    serviceHours: defaultHours(businessHours),
  };
}

function normalizeHours(hours = [], businessHours = []) {
  return defaultHours(businessHours).map((day) => {
    const saved = hours.find((item) => item.dayOfWeek === day.dayOfWeek);
    if (!saved) return day;

    return {
      dayOfWeek: day.dayOfWeek,
      startTime: saved.startTime || day.startTime,
      endTime: saved.endTime || day.endTime,
      isClosed: day.isClosed ? true : saved.isClosed,
    };
  });
}

export default function ServicesManagement() {
  const toast = useToast();
  const { api } = useBusinessManage();
  const { t } = useLanguage();
  const dayNames = [t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday")];
  const [services, setServices] = useState(null);
  const [businessHours, setBusinessHours] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () =>
    Promise.all([api.listServices(), api.getWorkingHours()]).then(([servicesResponse, hoursResponse]) => {
      setServices(servicesResponse.services);
      setBusinessHours(hoursResponse.workingHours || []);
    });

  useEffect(() => { load(); }, [api]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(businessHours));
    setModal(true);
  };

  const openEdit = (service) => {
    setEditing(service.id);
    setForm({
      name: service.name,
      description: service.description || "",
      imageUrl: service.imageUrl || "",
      durationMinutes: service.durationMinutes,
      price: service.price,
      hasServiceHours: Boolean(service.workingHours?.length),
      serviceHours: normalizeHours(service.workingHours || [], businessHours),
    });
    setModal(true);
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const updateHour = (dayOfWeek, patch) => {
    setForm((current) => ({
      ...current,
      serviceHours: current.serviceHours.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        imageUrl: form.imageUrl,
        durationMinutes: Number(form.durationMinutes),
        price: Number(form.price),
        serviceHours: form.hasServiceHours ? form.serviceHours : [],
      };
      if (editing) await api.updateService(editing, payload);
      else await api.createService(payload);
      toast.success(editing ? t("svc.updated") : t("svc.added"));
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
      toast.success(t("svc.deleted"));
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
          <div className="page-title">{t("navServices")}</div>
          <div className="page-sub">{t("svc.sub")}</div>
        </div>
        <Button onClick={openCreate}>+ {t("svc.newService")}</Button>
      </div>

      {services.length ? (
        <div className="grid grid-3">
          {services.map((service) => (
            <div key={service.id} className="card card-pad">
              <div className="row-between">
                <div style={{ fontWeight: 700, fontSize: 16 }}>{service.name}</div>
                {!service.isActive && <Badge tone="muted">{t("svc.disabled")}</Badge>}
              </div>
              {service.imageUrl && <img src={service.imageUrl} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 12, marginTop: 12 }} />}
              {service.description && <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{service.description}</p>}
              <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
                <Badge tone="info">{service.durationMinutes} {t("minutes")}</Badge>
                <Badge tone="success">{fmtPrice(service.price)}</Badge>
                {service.workingHours?.length ? <Badge tone="warning">{t("svc.specialHours")}</Badge> : null}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 16 }}>
                <Button size="sm" variant="ghost" onClick={() => openEdit(service)}>{t("edit")}</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(service.id)}>{t("delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t("svc.noServices")} hint={t("svc.noServicesHint")} action={<Button onClick={openCreate}>+ {t("svc.newService")}</Button>} />
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t("svc.editService") : t("svc.newService")}
        footer={
          <>
            <Button form="svc-form" type="submit" loading={saving}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>{t("cancel")}</Button>
          </>
        }
      >
        <form id="svc-form" onSubmit={save} className="col" style={{ gap: 16 }}>
          <Field label={t("svc.name")}><Input value={form.name} onChange={set("name")} required /></Field>
          <Field label={t("svc.image")}>
            <LogoPicker
              value={form.imageUrl}
              onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))}
              onError={toast.error}
              chooseText={t("svc.chooseImage")}
              changeText={t("svc.changeImage")}
              removeText={t("svc.removeImage")}
              previewAlt={t("svc.image")}
            />
          </Field>
          <Field label={t("svc.notes")}>
            <Textarea
              value={form.description}
              onChange={set("description")}
              placeholder={t("svc.notesPlaceholder")}
            />
          </Field>
          <div className="grid grid-2">
            <Field label={t("svc.duration")}><Input type="number" min="5" step="5" value={form.durationMinutes} onChange={set("durationMinutes")} required /></Field>
            <Field label={t("svc.price")}><Input type="number" min="0" value={form.price} onChange={set("price")} /></Field>
          </div>

          <label className="row" style={{ gap: 8, cursor: "pointer", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={form.hasServiceHours}
              onChange={(event) => setForm((current) => ({
                ...current,
                hasServiceHours: event.target.checked,
                serviceHours: event.target.checked ? normalizeHours(current.serviceHours, businessHours) : current.serviceHours,
              }))}
            />
            {t("svc.customHours")}
          </label>

          {form.hasServiceHours && (
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <div className="col" style={{ gap: 8 }}>
                {form.serviceHours.map((day) => {
                  const businessDay = businessHours.find((item) => item.dayOfWeek === day.dayOfWeek);
                  const businessClosed = businessDay?.isClosed === true;
                  return (
                    <div key={day.dayOfWeek} className="row wrap" style={{ gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 90, fontWeight: 700 }}>{dayNames[day.dayOfWeek]}</div>
                      <label className="row" style={{ gap: 6, width: 130, opacity: businessClosed ? 0.55 : 1 }}>
                        <input
                          type="checkbox"
                          checked={!day.isClosed && !businessClosed}
                          disabled={businessClosed}
                          onChange={(event) => updateHour(day.dayOfWeek, { isClosed: !event.target.checked })}
                        />
                        <span className={day.isClosed || businessClosed ? "soft" : ""}>{businessClosed || day.isClosed ? t("svc.closed") : t("svc.available")}</span>
                      </label>
                      <div className="row" style={{ gap: 8, opacity: day.isClosed || businessClosed ? 0.45 : 1, pointerEvents: day.isClosed || businessClosed ? "none" : "auto" }}>
                        <Input type="time" value={day.startTime} onChange={(event) => updateHour(day.dayOfWeek, { startTime: event.target.value })} style={{ width: 125 }} />
                        <span className="soft">{t("svc.to")}</span>
                        <Input type="time" value={day.endTime} onChange={(event) => updateHour(day.dayOfWeek, { endTime: event.target.value })} style={{ width: 125 }} />
                      </div>
                      {businessClosed && <span className="help-text">{t("svc.dayClosed")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title={t("svc.deleteTitle")}
        message={t("svc.deleteMsg")}
        confirmText={t("delete")}
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </>
  );
}
