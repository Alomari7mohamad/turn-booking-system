import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/endpoints.js";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { Button, Field, Input } from "../components/ui.jsx";
import { adminFavicon } from "../favicon.js";
import { resetBrandTheme } from "../brandTheme.js";

export default function ForgotPassword() {
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
      setMessage(res.message || "إذا كان البريد موجودًا لدينا فستصل رسالة تحتوي على رابط تغيير كلمة السر");
      if (res.devResetUrl) setDevResetUrl(res.devResetUrl);
    } catch (err) {
      setMessage(err.message || "تعذر إرسال طلب الاستعادة");
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
          <h2>استعادة كلمة السر</h2>
          <p>أدخل البريد الإلكتروني المرتبط بحسابك، وسنرسل لك رابطًا لتعيين كلمة سر جديدة.</p>

          <form onSubmit={submit} className="auth-login-form">
            <Field label="البريد الإلكتروني">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </Field>
            <Button type="submit" size="lg" block loading={loading}>إرسال رابط الاستعادة</Button>
          </form>

          {message && <div className="auth-status-message">{message}</div>}
          {devResetUrl && (
            <a className="auth-dev-link" href={devResetUrl}>
              رابط التجربة المحلي
            </a>
          )}

          <div className="auth-policy-links">
            <Link to="/login">العودة إلى تسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
