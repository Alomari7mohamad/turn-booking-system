export function Spinner({ page }) {
  if (page) {
    return (
      <div className="spinner-page">
        <div className="spinner" />
      </div>
    );
  }
  return <div className="spinner" />;
}

export function Button({ variant = "primary", size, block, loading, className = "", children, ...rest }) {
  const cls = ["btn", `btn-${variant}`, size && `btn-${size}`, block && "btn-block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

export function Badge({ tone = "muted", children }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function StatCard({ icon, value, label, tone = "primary" }) {
  const bg = {
    primary: "var(--primary-soft)",
    success: "var(--success-soft)",
    warning: "var(--warning-soft)",
    info: "var(--info-soft)",
  }[tone];
  return (
    <div className="stat">
      <div className="stat-icon" style={{ background: bg }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function EmptyState({ icon = "", title, hint, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div style={{ fontWeight: 700, color: "var(--text)" }}>{title}</div>
      {hint && <div style={{ marginTop: 4 }}>{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      {children}
      {error ? <span className="error-text">{error}</span> : hint && <span className="help-text">{hint}</span>}
    </div>
  );
}

export function Input({ error, ...rest }) {
  return <input className={`input ${error ? "input-error" : ""}`} {...rest} />;
}

export function Select({ children, ...rest }) {
  return (
    <select className="select" {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ ...rest }) {
  return <textarea className="textarea" {...rest} />;
}

export const fmtNumber = (n) => Number(n ?? 0).toLocaleString("en-US");

export const fmtPrice = (n) => `${fmtNumber(n)} ₪`;

export const fmtDate = (d) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
};

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const STATUS_META = {
  PENDING: { label: "بانتظار التأكيد", tone: "warning" },
  CONFIRMED: { label: "مؤكد", tone: "info" },
  COMPLETED: { label: "مكتمل", tone: "success" },
  CANCELLED: { label: "مرفوض", tone: "danger" },
  NO_SHOW: { label: "لم يحضر", tone: "muted" },
  ARCHIVED: { label: "مؤرشف", tone: "muted" },
};

export const PAYMENT_STATUS_META = {
  PENDING: { label: "بانتظار الدفع", tone: "warning" },
  PAID: { label: "مدفوع", tone: "success" },
  FAILED: { label: "فشل الدفع", tone: "danger" },
  REFUNDED: { label: "مسترجع", tone: "muted" },
};

export const PAYMENT_METHOD_META = {
  ONLINE: { label: "دفع إلكتروني", icon: "" },
  PAY_AT_STORE: { label: "دفع في المحل", icon: "" },
};

