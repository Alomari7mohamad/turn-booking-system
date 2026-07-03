import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Button, Field, Input } from "../components/ui.jsx";
import { adminFavicon } from "../favicon.js";
import { resetBrandTheme } from "../brandTheme.js";

const demoAccounts = [
  { roleKey: "adminRole", email: "admin@booking.com", pass: "admin123" },
  { roleKey: "ownerRole", email: "owner@salon.com", pass: "owner123" },
  { roleKey: "staffRole", email: "staff@salon.com", pass: "staff123" },
];

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resetBrandTheme();
    adminFavicon();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`${t("welcome")} ${user.name}`);
      navigate("/");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-language">
        <LanguageSwitcher />
      </div>
      <aside className="auth-aside">
        <div className="brand-logo login-logo">
          <img src="/oh-tech-logo.jpg" alt="O&H Tech" />
        </div>
        <h1>{t("platformTitle")}</h1>
        <p>{t("platformSubtitle")}</p>
        <div className="col" style={{ gap: 14, marginTop: 10 }}>
          <div className="auth-feature"><span>✓</span> {t("dataIsolation")}</div>
          <div className="auth-feature"><span>✓</span> {t("smartBooking")}</div>
          <div className="auth-feature"><span>✓</span> {t("publicPage")}</div>
        </div>
      </aside>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>{t("loginTitle")}</h2>
          <p className="muted" style={{ marginBottom: 22 }}>{t("loginSubtitle")}</p>

          <form onSubmit={submit} className="col" style={{ gap: 16 }}>
            <Field label={t("email")}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </Field>
            <Field label={t("password")}>
              <div className="password-input">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  title={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" block loading={loading}>
              {t("login")}
            </Button>
          </form>

          <div className="demo-box">
            <b>{t("demoAccounts")}</b> ({t("fillOnClick")}):
            <div className="mt-1">
              {demoAccounts.map((account) => (
                <div
                  key={account.email}
                  className="demo-row"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.pass);
                  }}
                >
                  <span>{t(account.roleKey)}</span>
                  <span className="soft">{account.email}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-policy-links">
            <Link to="/privacy">{t("privacyPolicy")}</Link>
            <span>·</span>
            <Link to="/terms">{t("sitePolicy")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className="password-eye-icon">
      <path
        fill="currentColor"
        d="M12 5c5 0 8.5 4.5 9.5 7-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7C3.5 9.5 7 5 12 5Zm0 2c-3.55 0-6.25 2.85-7.25 5 1 2.15 3.7 5 7.25 5s6.25-2.85 7.25-5c-1-2.15-3.7-5-7.25-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className="password-eye-icon">
      <path
        fill="currentColor"
        d="M4.3 3 21 19.7 19.7 21l-3-3A10 10 0 0 1 12 19c-5 0-8.5-4.5-9.5-7a13.2 13.2 0 0 1 3.2-4.35L3 4.3 4.3 3Zm3 6.35A9.4 9.4 0 0 0 4.75 12c1 2.15 3.7 5 7.25 5 1.1 0 2.12-.27 3.02-.7l-1.72-1.72a2.8 2.8 0 0 1-3.88-3.88L7.3 9.35ZM12 5c5 0 8.5 4.5 9.5 7a12.6 12.6 0 0 1-2.25 3.35l-1.42-1.42A9.6 9.6 0 0 0 19.25 12c-1-2.15-3.7-5-7.25-5-.77 0-1.5.13-2.18.36L8.25 5.78A9.5 9.5 0 0 1 12 5Z"
      />
    </svg>
  );
}
