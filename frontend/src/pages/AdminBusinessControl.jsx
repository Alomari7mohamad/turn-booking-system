import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { adminApi, adminManagedBusinessApi } from "../api/endpoints.js";
import { BusinessManageProvider } from "../context/BusinessManageContext.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";

const TABS = [
  { to: "", label: "لوحة المحل", end: true },
  { to: "appointments", label: "الحجوزات" },
  { to: "appointments/rejected", label: "الحجوزات التي تم رفضها" },
  { to: "services", label: "الخدمات" },
  { to: "employees", label: "الموظفون" },
  { to: "working-hours", label: "ساعات العمل" },
  { to: "settings", label: "الإعدادات" },
  { to: "subscription", label: "الاشتراك" },
  { to: "activity", label: "سجل النشاط" },
];

export default function AdminBusinessControl() {
  const { businessId } = useParams();
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi.getBusiness(businessId).then((r) => setBusiness(r.business)).catch(() => setError(true));
  }, [businessId]);

  const api = useMemo(() => adminManagedBusinessApi(businessId), [businessId]);
  const basePath = `/admin/businesses/${businessId}/control`;

  if (error) return <EmptyState icon="🏪" title="تعذر فتح المحل" hint="تحقق من أن المحل موجود ثم حاول مرة أخرى" />;
  if (!business) return <Spinner page />;

  return (
    <BusinessManageProvider value={{ api, basePath, business, isAdminManaging: true }}>
      <div className="page-head">
        <div>
          <div className="page-title">تحكم عن بعد: {business.name}</div>
          <div className="page-sub">إدارة كاملة لمساعدة صاحب المحل عند الحاجة</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </BusinessManageProvider>
  );
}
