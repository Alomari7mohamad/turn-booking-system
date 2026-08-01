import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import i18n from "../i18n/index.js";
import { Spinner, Badge, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";

// Enum -> display metadata. Technical action codes stay in the DB; labels are
// live getters so the log follows the active language.
const ACTION_META = {
  BOOKING_CREATED: { get label() { return i18n.t("audit.actCreated"); }, tone: "success" },
  BOOKING_CANCELLED: { get label() { return i18n.t("audit.actCancelled"); }, tone: "danger" },
  BOOKING_UPDATED: { get label() { return i18n.t("audit.actUpdated"); }, tone: "info" },
  PAYMENT_STATUS_CHANGED: { get label() { return i18n.t("audit.actPayStatus"); }, tone: "warning" },
  PAYMENT_SETTINGS_CHANGED: { get label() { return i18n.t("audit.actPaySettings"); }, tone: "primary" },
  BUSINESS_SETTINGS_CHANGED: { get label() { return i18n.t("audit.actBizSettings"); }, tone: "info" },
  WORKING_HOURS_CHANGED: { get label() { return i18n.t("audit.actHours"); }, tone: "primary" },
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

const ENTITY_LABELS = {
  get Appointment() { return i18n.t("audit.entityAppointment"); },
  get Business() { return i18n.t("audit.entityBusiness"); },
  get WorkingHours() { return i18n.t("audit.entityWorkingHours"); },
  get EmployeeWorkingHours() { return i18n.t("audit.entityEmployeeHours"); },
};

const formatMetaValue = (key, value) => {
  if (key === "changes" && Array.isArray(value)) return value.map((item) => FIELD_LABELS[item] || item).join("، ");
  if (typeof value === "boolean") return value ? i18n.t("audit.enabled") : i18n.t("audit.disabled");
  return String(value);
};

const formatMeta = (meta) => Object.entries(meta).map(([key, value]) => ({
  key,
  label: FIELD_LABELS[key] || key,
  value: formatMetaValue(key, value),
}));

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

      {logs.length ? (
        <section className="audit-log-grid">
          {logs.map((l) => {
            const m = ACTION_META[l.action] || { label: l.action, tone: "muted" };
            let meta = null;
            try { meta = typeof l.meta === "string" ? JSON.parse(l.meta) : l.meta; } catch { meta = null; }
            const metaItems = meta ? formatMeta(meta) : [];
            return (
              <article className={`audit-log-card audit-log-tone-${m.tone}`} key={l.id}>
                <header className="audit-log-card-head">
                  <Badge tone={m.tone}>{m.label}</Badge>
                  <time dateTime={l.createdAt}>
                    <strong>{fmtDate(l.createdAt)}</strong>
                    <span>{fmtTime(l.createdAt)}</span>
                  </time>
                </header>

                <div className="audit-log-card-body">
                  <div className="audit-log-entity">
                    <span>{t("audit.details")}</span>
                    <strong>{ENTITY_LABELS[l.entityType] || l.entityType}{l.entityId ? ` #${l.entityId}` : ""}</strong>
                  </div>

                  {metaItems.length > 0 && (
                    <div className="audit-log-meta">
                      {metaItems.map((item) => (
                        <div key={item.key}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="audit-log-card-footer">
                  <span>{t("audit.by")}</span>
                  <strong>{l.actorName || "—"}</strong>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState title={t("audit.noEvents")} hint={t("audit.noEventsHint")} />
      )}
    </>
  );
}
