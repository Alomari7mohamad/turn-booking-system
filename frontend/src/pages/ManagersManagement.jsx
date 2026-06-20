import { useEffect, useState } from "react";
import { adminApi } from "../api/endpoints.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { Button, Field, Input, Spinner, EmptyState, fmtDate } from "../components/ui.jsx";

const emptyForm = { id: null, name: "", phone: "", email: "", password: "" };

export default function ManagersManagement() {
  const toast = useToast();
  const { t } = useLanguage();
  const [managers, setManagers] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.listManagers().then((r) => setManagers(r.managers));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (manager) => {
    setForm({
      id: manager.id,
      name: manager.name || "",
      phone: manager.phone || "",
      email: manager.email || "",
      password: "",
    });
    setModal(true);
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
      };
      if (form.id) await adminApi.updateManager(form.id, payload);
      else await adminApi.createManager({ ...payload, password: form.password });
      toast.success(form.id ? t("managerUpdated") : t("managerAdded"));
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!managers) return <Spinner page />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("managersManagementTitle")}</div>
          <div className="page-sub">{t("managersManagementSub")}</div>
        </div>
        <Button onClick={openCreate}>{t("newManager")}</Button>
      </div>

      <div className="card">
        {managers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("managerName")}</th>
                  <th>{t("phone")}</th>
                  <th>{t("email")}</th>
                  <th>{t("addedDate")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr key={manager.id}>
                    <td style={{ fontWeight: 700 }}>{manager.name}</td>
                    <td>{manager.phone || <span className="soft">-</span>}</td>
                    <td className="muted">{manager.email}</td>
                    <td>{fmtDate(manager.createdAt)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(manager)}>
                        {t("edit")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="👥" title={t("noManagers")} hint={t("addFirstManagerHint")} action={<Button onClick={openCreate}>{t("newManager")}</Button>} />
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? t("editManager") : t("addManager")}
        footer={
          <>
            <Button form="manager-form" type="submit" loading={saving}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setModal(false)}>{t("cancel")}</Button>
          </>
        }
      >
        <form id="manager-form" onSubmit={save} className="col" style={{ gap: 16 }}>
          <Field label={t("managerName")}><Input value={form.name} onChange={set("name")} required /></Field>
          <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label={t("email")}><Input type="email" value={form.email} onChange={set("email")} required /></Field>
          <Field label={t("password")} hint={form.id ? t("leavePasswordBlank") : ""}>
            <Input type="text" value={form.password} onChange={set("password")} required={!form.id} />
          </Field>
        </form>
      </Modal>
    </>
  );
}
