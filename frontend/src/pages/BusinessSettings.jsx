import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Button, Field, Input, Spinner } from "../components/ui.jsx";
import { LogoPicker } from "../components/LogoPicker.jsx";

// مفتاح تبديل (toggle) بسيط
function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="row-between" style={{ cursor: "pointer", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="soft" style={{ fontSize: 13 }}>{hint}</div>}
      </div>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 46, height: 26, borderRadius: 999, flexShrink: 0,
          background: checked ? "var(--primary)" : "var(--border-strong)",
          position: "relative", transition: "background .15s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, [checked ? "left" : "right"]: 3,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          transition: "all .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }} />
      </span>
    </label>
  );
}

export default function BusinessSettings() {
  const toast = useToast();
  const { api } = useBusinessManage();
  const { updateCurrentBusiness } = useAuth();
  const [form, setForm] = useState(null);
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.me().then((r) => {
      setForm({
        name: r.business.name,
        email: r.business.email || "",
        phone: r.business.phone || "",
        address: r.business.address || "",
        logoUrl: r.business.logoUrl || "",
        brandColor: r.business.brandColor || "#064e3b",
        timezone: r.business.timezone || "Asia/Riyadh",
        onlinePaymentEnabled: r.business.onlinePaymentEnabled,
        payAtStoreEnabled: r.business.payAtStoreEnabled,
      });
      setSlug(r.business.slug);
    });
  }, [api]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.onlinePaymentEnabled && !form.payAtStoreEnabled) {
      return toast.error("يجب تفعيل طريقة دفع واحدة على الأقل ليتمكّن الزبائن من الحجز");
    }
    setSaving(true);
    try {
      const result = await api.update(form);
      updateCurrentBusiness?.(result.business);
      toast.success("تم حفظ الإعدادات");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner page />;

  const noMethod = !form.onlinePaymentEnabled && !form.payAtStoreEnabled;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">إعدادات المحل</div>
          <div className="page-sub">عدّل بيانات محلّك وإعدادات الدفع</div>
        </div>
      </div>

      <form onSubmit={save} className="business-settings-form">
        <div className="settings-grid">
          <div className="card">
            <div className="card-header"><h3 className="card-title">البيانات الأساسية</h3></div>
            <div className="card-pad col" style={{ gap: 16 }}>
              <Field label="اسم المحل"><Input value={form.name} onChange={set("name")} required /></Field>
              <Field label="رابط الحجز" hint="يُدار من قبل الإدارة">
                <Input value={`/book/${slug}`} disabled />
              </Field>
              <div className="grid grid-2">
                <Field label="البريد الإلكتروني"><Input type="email" value={form.email} onChange={set("email")} /></Field>
                <Field label="الهاتف"><Input value={form.phone} onChange={set("phone")} /></Field>
              </div>
              <Field label="العنوان"><Input value={form.address} onChange={set("address")} /></Field>
              <div className="grid grid-2">
                <Field label="شعار المحل">
                  <LogoPicker value={form.logoUrl} onChange={(logoUrl) => setVal("logoUrl", logoUrl)} onError={toast.error} />
                </Field>
                <Field label="لون المحل">
                  <div className="row" style={{ gap: 10 }}>
                    <Input className="color-picker" type="color" value={form.brandColor} onChange={set("brandColor")} />
                    <span className="soft">{form.brandColor}</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💳 إعدادات الدفع</h3>
            </div>
            <div className="card-pad">
              <Toggle
                label="الدفع الإلكتروني"
                hint="السماح للزبائن بالدفع عبر بوابة الدفع عند الحجز"
                checked={form.onlinePaymentEnabled}
                onChange={(v) => setVal("onlinePaymentEnabled", v)}
              />
              <Toggle
                label="الدفع في المحل"
                hint="السماح للزبائن بتأكيد الحجز والدفع عند الحضور"
                checked={form.payAtStoreEnabled}
                onChange={(v) => setVal("payAtStoreEnabled", v)}
              />
              {noMethod && (
                <div className="error-text mt-2">⚠ يجب تفعيل طريقة دفع واحدة على الأقل، وإلا لن يتمكّن الزبائن من الحجز.</div>
              )}
            </div>
          </div>
        </div>

        <div className="settings-actions"><Button type="submit" loading={saving}>حفظ التغييرات</Button></div>
      </form>
    </>
  );
}
