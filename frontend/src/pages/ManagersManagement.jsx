import { useEffect, useState } from "react";
import { adminApi } from "../api/endpoints.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Modal } from "../components/Modal.jsx";
import { Button, Field, Input, Spinner, EmptyState, fmtDate } from "../components/ui.jsx";

const emptyForm = { id: null, name: "", phone: "", email: "", password: "" };

function PasswordEye({ visible }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className="password-eye-icon">
      {visible ? (
        <path fill="currentColor" d="M4.3 3 21 19.7 19.7 21l-3-3A10 10 0 0 1 12 19c-5 0-8.5-4.5-9.5-7a13.2 13.2 0 0 1 3.2-4.35L3 4.3 4.3 3Zm3 6.35A9.4 9.4 0 0 0 4.75 12c1 2.15 3.7 5 7.25 5 1.1 0 2.12-.27 3.02-.7l-1.72-1.72a2.8 2.8 0 0 1-3.88-3.88L7.3 9.35ZM12 5c5 0 8.5 4.5 9.5 7a12.6 12.6 0 0 1-2.25 3.35l-1.42-1.42A9.6 9.6 0 0 0 19.25 12c-1-2.15-3.7-5-7.25-5-.77 0-1.5.13-2.18.36L8.25 5.78A9.5 9.5 0 0 1 12 5Z" />
      ) : (
        <path fill="currentColor" d="M12 5c5 0 8.5 4.5 9.5 7-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7C3.5 9.5 7 5 12 5Zm0 2c-3.55 0-6.25 2.85-7.25 5 1 2.15 3.7 5 7.25 5s6.25-2.85 7.25-5c-1-2.15-3.7-5-7.25-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
      )}
    </svg>
  );
}

export default function ManagersManagement() {
  const toast = useToast();
  const { t } = useLanguage();
  const [managers, setManagers] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = () => adminApi.listManagers().then((r) => setManagers(r.managers));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setShowPassword(false);
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
    setShowPassword(false);
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
            <div className="password-field">
              <Input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} required={!form.id} />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                title={showPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
              >
                <PasswordEye visible={showPassword} />
              </button>
            </div>
          </Field>
        </form>
      </Modal>
    </>
  );
}
