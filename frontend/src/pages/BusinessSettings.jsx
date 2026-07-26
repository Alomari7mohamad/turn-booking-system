import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { Button, Field, Input, Spinner } from "../components/ui.jsx";
import { LogoPicker } from "../components/LogoPicker.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

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
          width: 46,
          height: 26,
          borderRadius: 999,
          flexShrink: 0,
          background: checked ? "var(--primary)" : "var(--border-strong)",
          position: "relative",
          transition: "background .15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            [checked ? "left" : "right"]: 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "all .15s",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </span>
    </label>
  );
}

export default function BusinessSettings() {
  const toast = useToast();
  const { t } = useLanguage();
  const { api } = useBusinessManage();
  const { updateCurrentBusiness } = useAuth();
  const [form, setForm] = useState(null);
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedBookingUrl, setCopiedBookingUrl] = useState(false);

  useEffect(() => {
    api.me().then((r) => {
      setForm({
        name: r.business.name,
        email: r.business.email || "",
        phone: r.business.phone || "",
        address: r.business.address || "",
        mapUrl: r.business.mapUrl || "",
        logoUrl: r.business.logoUrl || "",
        bookingHeroImageUrl: r.business.bookingHeroImageUrl || "",
        brandColor: r.business.brandColor || "#064e3b",
        timezone: r.business.timezone || "Asia/Riyadh",
        onlinePaymentEnabled: r.business.onlinePaymentEnabled,
        payAtStoreEnabled: r.business.payAtStoreEnabled,
        customerHubEnabled: r.business.customerHubEnabled !== false,
      });
      setSlug(r.business.slug);
    });
  }, [api]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setVal = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.onlinePaymentEnabled && !form.payAtStoreEnabled) {
      return toast.error(t("bs.needPayment"));
    }

    setSaving(true);
    try {
      const result = await api.update(form);
      updateCurrentBusiness?.(result.business);
      toast.success(t("bs.saved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner page />;

  const noMethod = !form.onlinePaymentEnabled && !form.payAtStoreEnabled;
  const bookingUrl = `${window.location.origin}/book/${slug}`;

  const copyBookingUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopiedBookingUrl(true);
      setTimeout(() => setCopiedBookingUrl(false), 3000);
      toast.success(t("bd.bookingLinkCopied"));
    } catch {
      toast.error(t("bd.copyFailed"));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("navSettings")}</div>
          <div className="page-sub">{t("bs.sub")}</div>
        </div>
        <Button form="business-settings-form" type="submit" loading={saving}>{t("wh.saveChanges")}</Button>
      </div>

      <form id="business-settings-form" onSubmit={save} className="business-settings-form">
        <div className="settings-grid">
          <div className="card">
            <div className="card-header"><h3 className="card-title">{t("bs.basicData")}</h3></div>
            <div className="card-pad col" style={{ gap: 16 }}>
              <Field label={t("bs.businessName")}><Input value={form.name} onChange={set("name")} required /></Field>
              <Field label={t("bs.bookingLink")} hint={t("bs.bookingLinkHint")}>
                <div className="row" style={{ gap: 10 }}>
                  <Input value={bookingUrl} readOnly onFocus={(event) => event.target.select()} />
                  <Button type="button" variant="secondary" onClick={copyBookingUrl}>{t("copy")}</Button>
                </div>
                {copiedBookingUrl && <div className="copy-inline-message">{t("bd.bookingLinkCopied")}</div>}
              </Field>
              <div className="grid grid-2">
                <Field label={t("email")}><Input type="email" value={form.email} onChange={set("email")} /></Field>
                <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
              </div>
              <Field label={t("bs.address")}><Input value={form.address} onChange={set("address")} /></Field>
              <Field label={t("bs.mapUrl")} hint={t("bs.mapUrlHint")}>
                <Input value={form.mapUrl} onChange={set("mapUrl")} placeholder={t("bs.mapUrlPlaceholder")} />
              </Field>
              <div className="grid grid-2">
                <Field label={t("storeLogo")}>
                  <LogoPicker
                    value={form.logoUrl}
                    onChange={(logoUrl) => setVal("logoUrl", logoUrl)}
                    onError={toast.error}
                    chooseText={t("lp.chooseLogo")}
                    changeText={t("lp.changeLogo")}
                    removeText={t("lp.removeLogo")}
                    previewAlt={t("lp.logoAlt")}
                  />
                </Field>
                <Field label={t("bs.heroImage")}>
                  <LogoPicker
                    value={form.bookingHeroImageUrl}
                    onChange={(imageUrl) => setVal("bookingHeroImageUrl", imageUrl)}
                    onError={toast.error}
                    chooseText={t("svc.chooseImage")}
                    changeText={t("svc.changeImage")}
                    removeText={t("svc.removeImage")}
                    previewAlt={t("bs.heroImage")}
                    imageOptions={{ maxSize: 1100, minSize: 360, quality: 0.8, maxBytes: 520 * 1024 }}
                  />
                </Field>
              </div>
              <div className="grid grid-2">
                <Field label={t("bs.brandColor")}>
                  <div className="row" style={{ gap: 10 }}>
                    <Input className="color-picker" type="color" value={form.brandColor} onChange={set("brandColor")} />
                    <span className="soft">{form.brandColor}</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">{t("bs.paymentSettings")}</h3></div>
            <div className="card-pad">
              <Toggle
                label={t("bs.onlinePayment")}
                hint={t("bs.onlinePaymentHint")}
                checked={form.onlinePaymentEnabled}
                onChange={(value) => setVal("onlinePaymentEnabled", value)}
              />
              <Toggle
                label={t("pb.payAtStore")}
                hint={t("bs.payAtStoreHint")}
                checked={form.payAtStoreEnabled}
                onChange={(value) => setVal("payAtStoreEnabled", value)}
              />
              {noMethod && <div className="error-text mt-2">{t("bs.needPaymentInline")}</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">{t("bs.customerHub")}</h3></div>
            <div className="card-pad">
              <Toggle
                label={t("bs.enableHub")}
                hint={t("bs.enableHubHint")}
                checked={form.customerHubEnabled}
                onChange={(value) => setVal("customerHubEnabled", value)}
              />
            </div>
          </div>
        </div>

        <div className="settings-actions"><Button type="submit" loading={saving}>{t("wh.saveChanges")}</Button></div>
      </form>
    </>
  );
}
