import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/endpoints.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { StatCard, Spinner, Badge, Button, EmptyState, fmtNumber } from "../components/ui.jsx";

export default function SuperAdminDashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    adminApi.stats().then(setData).catch(() => setData({ error: true }));
  }, []);

  if (!data) return <Spinner page />;

  const s = data.stats || {};
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t("adminDashboardTitle")}</div>
          <div className="page-sub">{t("adminDashboardSub")}</div>
        </div>
        <Link to="/admin/businesses">
          <Button>{t("addNewBusiness")}</Button>
        </Link>
      </div>

      <div className="grid grid-stats">
        <StatCard icon="▣" value={fmtNumber(s.businesses)} label={t("totalBusinesses")} tone="primary" />
        <StatCard icon="✓" value={fmtNumber(s.activeBusinesses)} label={t("activeBusinesses")} tone="success" />
        <StatCard icon="□" value={fmtNumber(s.appointments)} label={t("totalAppointments")} tone="info" />
        <StatCard icon="◉" value={fmtNumber(s.owners)} label={t("businessOwners")} tone="warning" />
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">{t("latestBusinesses")}</h3>
          <Link to="/admin/businesses" className="muted" style={{ fontSize: 13 }}>
            {t("viewAll")}
          </Link>
        </div>
        {data.recent?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("business")}</th>
                  <th>{t("link")}</th>
                  <th>{t("navAppointments")}</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((business) => (
                  <tr key={business.id}>
                    <td style={{ fontWeight: 600 }}>{business.name}</td>
                    <td className="muted">/book/{business.slug}</td>
                    <td>{fmtNumber(business.appointments)}</td>
                    <td>
                      <Badge tone={business.isActive ? "success" : "danger"}>
                        {business.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="▣" title={t("noBusinessesYet")} hint={t("addFirstBusinessHint")} />
        )}
      </div>
    </>
  );
}

