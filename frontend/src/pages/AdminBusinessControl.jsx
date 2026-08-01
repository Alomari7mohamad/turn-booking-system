import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { adminApi, adminManagedBusinessApi } from "../api/endpoints.js";
import { BusinessManageProvider } from "../context/BusinessManageContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Spinner, EmptyState } from "../components/ui.jsx";

const TABS = [
  { to: "", key: "abc.storeDashboard", end: true },
  { to: "statistics", key: "navStatistics" },
  { to: "customers", key: "navCustomers" },
  { to: "appointments", key: "navAppointments" },
  { to: "appointments/late", key: "navLateAppointments" },
  { to: "appointments/archive", key: "navArchive" },
  { to: "services", key: "navServices" },
  { to: "employees", key: "navEmployees" },
  { to: "secretary", key: "navSecretary" },
  { to: "accounts", key: "navAccounts" },
  { to: "working-hours", key: "navWorkingHours" },
  { to: "settings", key: "abc.settings" },
  { to: "subscription", key: "navSubscription" },
  { to: "activity", key: "navActivity" },
];

export default function AdminBusinessControl() {
  const { businessId } = useParams();
  const { t } = useLanguage();
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi.getBusiness(businessId).then((r) => setBusiness(r.business)).catch(() => setError(true));
  }, [businessId]);

  const api = useMemo(() => adminManagedBusinessApi(businessId), [businessId]);
  const basePath = `/admin/businesses/${businessId}/control`;

  if (error) return <EmptyState icon="▣" title={t("abc.cantOpen")} hint={t("abc.cantOpenHint")} />;
  if (!business) return <Spinner page />;

  return (
    <BusinessManageProvider value={{ api, basePath, business, isAdminManaging: true }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t("abc.remoteControl", { name: business.name })}</div>
          <div className="page-sub">{t("abc.sub")}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
            >
              {t(tab.key)}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </BusinessManageProvider>
  );
}
