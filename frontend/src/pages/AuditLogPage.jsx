import { useEffect, useState } from "react";
import { useBusinessManage } from "../context/BusinessManageContext.jsx";
import { Spinner, Badge, EmptyState, fmtDate, fmtTime } from "../components/ui.jsx";

const ACTION_META = {
  BOOKING_CREATED: { label: "إنشاء حجز", icon: "📅", tone: "success" },
  BOOKING_CANCELLED: { label: "إلغاء حجز", icon: "🚫", tone: "danger" },
  BOOKING_UPDATED: { label: "تعديل حجز", icon: "✏️", tone: "info" },
  PAYMENT_STATUS_CHANGED: { label: "تغيير حالة الدفع", icon: "💳", tone: "warning" },
  PAYMENT_SETTINGS_CHANGED: { label: "تغيير إعدادات الدفع", icon: "⚙️", tone: "primary" },
  BUSINESS_SETTINGS_CHANGED: { label: "تغيير بيانات المحل", icon: "🏪", tone: "info" },
  WORKING_HOURS_CHANGED: { label: "تغيير أوقات الدوام", icon: "🕐", tone: "primary" },
};

const FIELD_LABELS = {
  name: "اسم المحل",
  email: "البريد الإلكتروني",
  phone: "الهاتف",
  address: "العنوان",
  logoUrl: "الشعار",
  brandColor: "اللون",
  timezone: "المنطقة الزمنية",
  onlinePaymentEnabled: "الدفع الإلكتروني",
  payAtStoreEnabled: "الدفع في المحل",
};

const formatMetaValue = (key, value) => {
  if (key === "changes" && Array.isArray(value)) return value.map((item) => FIELD_LABELS[item] || item).join("، ");
  if (typeof value === "boolean") return value ? "مفعل" : "غير مفعل";
  return String(value);
};

const formatMeta = (meta) => Object.entries(meta)
  .map(([key, value]) => `${FIELD_LABELS[key] || key}: ${formatMetaValue(key, value)}`)
  .join(" · ");

const fmt = (d) => `${fmtDate(d)} ${fmtTime(d)}`;

export default function AuditLogPage() {
  const { api } = useBusinessManage();
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    api.auditLogs().then((r) => setLogs(r.logs)).catch(() => setLogs([]));
  }, [api]);

  if (!logs) return <Spinner page />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">سجلّ النشاط</div>
          <div className="page-sub">آخر 100 حدث مهم في محلّك (حجوزات، دفع، إعدادات)</div>
        </div>
      </div>

      <div className="card">
        {logs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الحدث</th>
                  <th>التفاصيل</th>
                  <th>بواسطة</th>
                  <th>الوقت</th>
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
          <EmptyState icon="📋" title="لا توجد أحداث بعد" hint="ستظهر هنا الأحداث المهمة عند حدوثها" />
        )}
      </div>
    </>
  );
}
