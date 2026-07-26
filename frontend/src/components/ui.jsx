import i18n from "../i18n/index.js";

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

// Enum -> display metadata. The technical keys (PENDING, ONLINE, ...) are the
// stable application values; the `label` is a getter that returns the label in
// the currently active language, so consumers reading `.label` stay unchanged.
export const STATUS_META = {
  PENDING: { get label() { return i18n.t("statusPending"); }, tone: "warning" },
  CONFIRMED: { get label() { return i18n.t("statusConfirmed"); }, tone: "info" },
  COMPLETED: { get label() { return i18n.t("statusCompleted"); }, tone: "success" },
  CANCELLED: { get label() { return i18n.t("statusCancelled"); }, tone: "danger" },
  NO_SHOW: { get label() { return i18n.t("statusNoShow"); }, tone: "muted" },
  ARCHIVED: { get label() { return i18n.t("statusArchived"); }, tone: "muted" },
};

export const PAYMENT_STATUS_META = {
  PENDING: { get label() { return i18n.t("payStatusPending"); }, tone: "warning" },
  PAID: { get label() { return i18n.t("payStatusPaid"); }, tone: "success" },
  FAILED: { get label() { return i18n.t("payStatusFailed"); }, tone: "danger" },
  REFUNDED: { get label() { return i18n.t("payStatusRefunded"); }, tone: "muted" },
};

export const PAYMENT_METHOD_META = {
  ONLINE: { get label() { return i18n.t("payMethodOnline"); }, icon: "" },
  PAY_AT_STORE: { get label() { return i18n.t("payMethodStore"); }, icon: "" },
};

