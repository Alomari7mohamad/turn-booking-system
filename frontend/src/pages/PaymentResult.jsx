import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { paymentApi } from "../api/endpoints.js";
import { Button, Spinner } from "../components/ui.jsx";
import { BookingConfirmation } from "../components/BookingConfirmation.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// صفحة نتيجة الدفع — تُستخدم لكل من النجاح والفشل عبر prop.
export default function PaymentResult({ status }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { state } = useLocation();
  const slug = state?.slug;
  const reference = state?.reference;
  const ok = status === "success";

  const [conf, setConf] = useState(null);
  const [loading, setLoading] = useState(ok && !!reference);

  // عند النجاح: نجلب تفاصيل الحجز لعرض بطاقة التأكيد الكاملة
  useEffect(() => {
    if (!ok || !reference) return;
    paymentApi
      .info(reference)
      .then((r) => setConf(r.payment))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ok, reference]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div className="card card-pad text-center">
          <div className="success-circle" style={ok ? {} : { background: "var(--danger-soft)", color: "var(--danger)" }}>
            {ok ? "✓" : "✕"}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>{ok ? t("pr.successTitle") : t("pr.failTitle")}</h2>
          <p className="muted mt-1">
            {ok ? t("pr.successText") : t("pr.failText")}
          </p>
        </div>

        {/* بطاقة تأكيد الحجز (عند النجاح) */}
        {ok && (loading ? <div className="mt-2"><Spinner /></div> : conf && (
          <div className="mt-2">
            <BookingConfirmation
              data={{
                bookingNumber: conf.bookingNumber,
                business: conf.business,
                service: conf.service,
                employee: conf.employee,
                startAt: conf.startAt,
                endAt: conf.endAt,
                amount: conf.amount,
                paymentMethod: conf.paymentMethod,
                paymentStatus: conf.status,
              }}
            />
          </div>
        ))}

        <div className="text-center mt-3">
          <Button onClick={() => navigate(slug ? `/book/${slug}` : "/")}>
            {ok ? t("bookAnother") : slug ? t("pr.retry") : t("pr.back")}
          </Button>
        </div>
      </div>
    </div>
  );
}
