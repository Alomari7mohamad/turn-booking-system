import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Spinner, Badge, StatCard, fmtPrice, fmtDate, fmtNumber } from "../components/ui.jsx";

export default function SubscriptionPage() {
  const { api, isAdminManaging } = useBusinessManage();
  const { t } = useLanguage();
  const [biz, setBiz] = useState(null);

  useEffect(() => { api.me().then((r) => setBiz(r.business)); }, [api]);
  if (!biz) return <Spinner page />;

  const sub = biz.subscriptions?.[0];
  const daysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.endsAt) - new Date()) / 86400000)) : 0;
  const active = sub && new Date(sub.endsAt) > new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("subscription")}</div>
          <div className="page-sub">{isAdminManaging ? t("adminSubscriptionSub") : t("businessSubscriptionSub")}</div>
        </div>
      </div>

      {sub ? (
        <>
          <div className="card" style={{ background: "var(--gradient)", color: "#fff", border: "none", marginBottom: 18 }}>
            <div className="card-pad">
              <div className="row-between wrap">
                <div>
                  <div style={{ opacity: 0.85, fontSize: 14 }}>{t("currentPlan")}</div>
                  <div style={{ fontSize: 30, fontWeight: 800 }}>{sub.plan === "YEARLY" ? t("yearlyPlan") : t("monthlyPlan")}</div>
                  <div style={{ opacity: 0.9, marginTop: 4 }}>{fmtPrice(sub.price)} / {sub.plan === "YEARLY" ? t("yearUnit") : t("monthUnit")}</div>
                </div>
                <span className="badge" style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>
                  <span className="dot" /> {active ? t("active") : t("expired")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-stats">
            <StatCard icon="□" value={fmtNumber(daysLeft)} label={t("remainingDays")} tone="primary" />
            <StatCard icon="▣" value={fmtDate(sub.startsAt)} label={t("subscriptionStart")} tone="info" />
            <StatCard icon="◷" value={fmtDate(sub.endsAt)} label={t("subscriptionEnd")} tone="warning" />
          </div>

          <div className="card card-pad mt-3">
            <p className="muted">{t("subscriptionContactHint")}</p>
          </div>
        </>
      ) : (
        <div className="card card-pad">
          <Badge tone="danger">{t("noActiveSubscription")}</Badge>
          <p className="muted mt-2">{t("activateSubscriptionHint")}</p>
        </div>
      )}
    </>
  );
}

