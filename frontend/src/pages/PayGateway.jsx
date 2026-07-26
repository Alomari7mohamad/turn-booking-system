import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { paymentApi } from "../api/endpoints.js";
import { Button, Spinner, EmptyState, fmtPrice, fmtDate, fmtTime } from "../components/ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// صفحة بوابة الدفع الوهمية (للتجربة المحلية فقط).
// في الإنتاج يُوجَّه الزبون لبوابة حقيقية (Stripe/PayTabs...) بدل هذه الصفحة.
export default function PayGateway() {
  const { reference } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    paymentApi.info(reference).then((r) => setPayment(r.payment)).catch((e) => setError(e.message));
  }, [reference]);

  const complete = async (outcome) => {
    setProcessing(true);
    try {
      await paymentApi.mockComplete(reference, outcome);
      navigate(outcome === "success" ? "/pay/success" : "/pay/failed", {
        state: { slug: payment.slug, reference },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (error)
    return (
      <Center>
        <EmptyState icon="⚠️" title={t("pg.loadError")} hint={error} />
      </Center>
    );
  if (!payment) return <Spinner page />;

  // إن كانت العملية مكتملة مسبقًا
  if (payment.status === "PAID")
    return (
      <Center>
        <EmptyState icon="✅" title={t("pg.alreadyPaid")} hint={t("pg.alreadyPaidHint")} />
      </Center>
    );

  return (
    <Center>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ background: "var(--gradient)", color: "#fff", padding: "22px 24px" }}>
          <div style={{ opacity: 0.85, fontSize: 13 }}>🔒 {t("pg.secureGateway")}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{fmtPrice(payment.amount)}</div>
          <div style={{ opacity: 0.9, fontSize: 13.5 }}>{payment.business}</div>
        </div>
        <div className="card-pad col" style={{ gap: 14 }}>
          <Row label={t("service")} value={payment.service} />
          <Row label={t("bc.employee")} value={payment.employee} />
          <Row label={t("pg.appointment")} value={`${fmtDate(payment.startAt)} · ${fmtTime(payment.startAt)}`} />
          <div className="help-text">{t("pg.disclaimer")}</div>
          <Button size="lg" block loading={processing} onClick={() => complete("success")}>
            💳 {t("pg.payNow")}
          </Button>
          <Button variant="ghost" block disabled={processing} onClick={() => complete("fail")}>
            {t("pg.simulateFail")}
          </Button>
        </div>
      </div>
    </Center>
  );
}

function Row({ label, value }) {
  return (
    <div className="row-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  );
}
