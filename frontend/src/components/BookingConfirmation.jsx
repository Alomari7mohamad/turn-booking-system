import { Badge, fmtDate, fmtTime, fmtPrice, PAYMENT_STATUS_META, PAYMENT_METHOD_META } from "./ui.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export function BookingConfirmation({ data }) {
  const { t } = useLanguage();
  const pm = PAYMENT_METHOD_META[data.paymentMethod];
  const ps = PAYMENT_STATUS_META[data.paymentStatus];
  const isFree = data.amount != null && Number(data.amount) === 0;

  return (
    <div className="card" style={{ overflow: "hidden", textAlign: "right" }}>
      <div style={{ background: "var(--surface-2)", padding: "14px 20px", borderBottom: "1px solid var(--border)" }} className="row-between">
        <span className="muted">{t("bc.bookingNumber")}</span>
        <span style={{ fontWeight: 800, fontFamily: "monospace", fontSize: 16 }}>#{data.bookingNumber}</span>
      </div>
      <div className="card-pad col" style={{ gap: 0 }}>
        {data.customerName && <Row label={t("bc.requester")} value={data.customerName} />}
        {data.customerPhone && <Row label={t("phoneNumber")} value={data.customerPhone} />}
        <Row label={t("bc.business")} value={data.business} />
        <Row label={t("service")} value={data.service} />
        <Row label={t("bc.employee")} value={data.employee} />
        <Row label={t("date")} value={fmtDate(data.startAt)} />
        <Row label={t("bc.time")} value={data.endAt ? `${fmtTime(data.startAt)} - ${fmtTime(data.endAt)}` : fmtTime(data.startAt)} />
        {data.amount != null && <Row label={t("bc.amount")} value={Number(data.amount) === 0 ? t("bc.freeService") : fmtPrice(data.amount)} />}
        <Row label={t("paymentMethod")} value={pm ? pm.label : "-"} />
        <Row
          label={t("bc.paymentStatus")}
          value={isFree ? <Badge tone="success">{t("bc.freeService")}</Badge> : ps ? <Badge tone={ps.tone}>{ps.label}</Badge> : "-"}
          last
        />
      </div>
    </div>
  );
}

function Row({ label, value, last }) {
  return (
    <div
      className="row-between"
      style={{ padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}
    >
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
