import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/endpoints.js";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Button, Field, Input } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { adminFavicon } from "../favicon.js";
import { resetBrandTheme } from "../brandTheme.js";

export default function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    resetBrandTheme();
    adminFavicon();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!token) {
      setMessage(t("rp.invalidLink"));
      return;
    }
    if (password.length < 6) {
      setMessage(t("rp.tooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setMessage(t("rp.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword({ token, password });
      setDone(true);
      setMessage(res.message || t("rp.success"));
    } catch (err) {
      setMessage(err.message || t("rp.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap auth-single" data-no-auto-translate="true">
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-language"><LanguageSwitcher /></div>
          <div className="auth-mobile-logo auth-single-logo">
            <img src="/oh-tech-logo2-transparent.png" alt="O&H Tech" />
          </div>
          <h2>{t("rp.title")}</h2>
          <p>{t("rp.subtitle")}</p>

          {!done && (
            <form onSubmit={submit} className="auth-login-form">
              <Field label={t("rp.newPassword")}>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </Field>
              <Field label={t("rp.confirmPassword")}>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </Field>
              <Button type="submit" size="lg" block loading={loading}>{t("rp.save")}</Button>
            </form>
          )}

          {message && <div className="auth-status-message">{message}</div>}

          <div className="auth-policy-links">
            <Link to="/login">{t("backToLogin")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
