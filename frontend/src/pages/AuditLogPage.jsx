import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";
import { Spinner, Badge, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";

// Enum -> display metadata. Technical action codes stay in the DB; labels are
// live getters so the log follows the active language.
const ACTION_META = {
  BOOKING_CREATED: { get label() { return i18n.t("audit.actCreated"); }, icon: "📅", tone: "success" },
  BOOKING_CANCELLED: { get label() { return i18n.t("audit.actCancelled"); }, icon: "🚫", tone: "danger" },
  BOOKING_UPDATED: { get label() { return i18n.t("audit.actUpdated"); }, icon: "✏️", tone: "info" },
  PAYMENT_STATUS_CHANGED: { get label() { return i18n.t("audit.actPayStatus"); }, icon: "💳", tone: "warning" },
  PAYMENT_SETTINGS_CHANGED: { get label() { return i18n.t("audit.actPaySettings"); }, icon: "⚙️", tone: "primary" },
  BUSINESS_SETTINGS_CHANGED: { get label() { return i18n.t("audit.actBizSettings"); }, icon: "🏪", tone: "info" },
  WORKING_HOURS_CHANGED: { get label() { return i18n.t("audit.actHours"); }, icon: "🕐", tone: "primary" },
};

const FIELD_LABELS = {
  get name() { return i18n.t("audit.fldName"); },
  get email() { return i18n.t("email"); },
  get phone() { return i18n.t("phone"); },
  get address() { return i18n.t("audit.fldAddress"); },
  get logoUrl() { return i18n.t("audit.fldLogo"); },
  get brandColor() { return i18n.t("audit.fldColor"); },
  get timezone() { return i18n.t("audit.fldTimezone"); },
  get onlinePaymentEnabled() { return i18n.t("audit.fldOnlinePay"); },
  get payAtStoreEnabled() { return i18n.t("audit.fldPayStore"); },
};

const formatMetaValue = (key, value) => {
  if (key === "changes" && Array.isArray(value)) return value.map((item) => FIELD_LABELS[item] || item).join("، ");
  if (typeof value === "boolean") return value ? i18n.t("audit.enabled") : i18n.t("audit.disabled");
  return String(value);
};

const formatMeta = (meta) => Object.entries(meta)
  .map(([key, value]) => `${FIELD_LABELS[key] || key}: ${formatMetaValue(key, value)}`)
  .join(" · ");

const fmt = (d) => `${fmtDate(d)} ${fmtTime(d)}`;

export default function AuditLogPage() {
  const { api } = useBusinessManage();
  const { t } = useLanguage();
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    api.auditLogs().then((r) => setLogs(r.logs)).catch(() => setLogs([]));
  }, [api]);

  if (!logs) return <Spinner page />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("audit.title")}</div>
          <div className="page-sub">{t("audit.sub")}</div>
        </div>
      </div>

      <div className="card">
        {logs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("audit.event")}</th>
                  <th>{t("audit.details")}</th>
                  <th>{t("audit.by")}</th>
                  <th>{t("audit.time")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const m = ACTION_META[l.action] || { label: l.action, icon: "•", tone: "muted" };
                  let meta = null;
                  try { meta = l.meta ? JSON.parse(l.meta) : null; } catch { meta = null; }
                  return (
                    <tr key={l.id}>
                      <td><Badge tone={m.tone}>{m.icon} {m.label}</Badge></td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {l.entityType}{l.entityId ? ` #${l.entityId}` : ""}
                        {meta && (
                          <span className="soft"> · {formatMeta(meta)}</span>
                        )}
                      </td>
                      <td>{l.actorName || "—"}</td>
                      <td className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmt(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="📋" title={t("audit.noEvents")} hint={t("audit.noEventsHint")} />
        )}
      </div>
    </>
  );
}
