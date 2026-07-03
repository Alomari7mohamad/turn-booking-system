import { Badge, fmtDate, fmtTime, fmtPrice, PAYMENT_STATUS_META, PAYMENT_METHOD_META } from "./ui.jsx";

export function BookingConfirmation({ data }) {
  const pm = PAYMENT_METHOD_META[data.paymentMethod];
  const ps = PAYMENT_STATUS_META[data.paymentStatus];
  const isFree = data.amount != null && Number(data.amount) === 0;

  return (
    <div className="card" style={{ overflow: "hidden", textAlign: "right" }}>
      <div style={{ background: "var(--surface-2)", padding: "14px 20px", borderBottom: "1px solid var(--border)" }} className="row-between">
        <span className="muted">رقم الحجز</span>
        <span style={{ fontWeight: 800, fontFamily: "monospace", fontSize: 16 }}>#{data.bookingNumber}</span>
      </div>
      <div className="card-pad col" style={{ gap: 0 }}>
        {data.customerName && <Row label="طالب الخدمة" value={data.customerName} />}
        {data.customerPhone && <Row label="رقم الهاتف" value={data.customerPhone} />}
        <Row label="المحل" value={data.business} />
        <Row label="الخدمة" value={data.service} />
        <Row label="الموظف" value={data.employee} />
        <Row label="التاريخ" value={fmtDate(data.startAt)} />
        <Row label="الوقت" value={data.endAt ? `${fmtTime(data.startAt)} - ${fmtTime(data.endAt)}` : fmtTime(data.startAt)} />
        {data.amount != null && <Row label="المبلغ" value={Number(data.amount) === 0 ? "الخدمة مجانية" : fmtPrice(data.amount)} />}
        <Row label="طريقة الدفع" value={pm ? pm.label : "-"} />
        <Row
          label="حالة الدفع"
          value={isFree ? <Badge tone="success">الخدمة مجانية</Badge> : ps ? <Badge tone={ps.tone}>{ps.label}</Badge> : "-"}
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
