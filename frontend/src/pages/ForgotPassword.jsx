import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/endpoints.js";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Button, Field, Input } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { adminFavicon } from "../favicon.js";
import { resetBrandTheme } from "../brandTheme.js";

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  useEffect(() => {
    resetBrandTheme();
    adminFavicon();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setDevResetUrl("");
    try {
      const res = await authApi.forgotPassword({ email });
      setMessage(res.message || t("fp.sentMsg"));
      if (res.devResetUrl) setDevResetUrl(res.devResetUrl);
    } catch (err) {
      setMessage(err.message || t("fp.error"));
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
          <h2>{t("fp.title")}</h2>
          <p>{t("fp.subtitle")}</p>

          <form onSubmit={submit} className="auth-login-form">
            <Field label={t("email")}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </Field>
            <Button type="submit" size="lg" block loading={loading}>{t("fp.submit")}</Button>
          </form>

          {message && <div className="auth-status-message">{message}</div>}
          {devResetUrl && (
            <a className="auth-dev-link" href={devResetUrl}>
              {t("fp.devLink")}
            </a>
          )}

          <div className="auth-policy-links">
            <Link to="/login">{t("backToLogin")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
