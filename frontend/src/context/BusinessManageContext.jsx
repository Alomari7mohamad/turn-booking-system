import { createContext, useContext, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { adminManagedBusinessApi, businessApi } from "../api/endpoints.js";

const BusinessManageContext = createContext({
  api: businessApi,
  basePath: "/dashboard",
  business: null,
  isAdminManaging: false,
});

export function BusinessManageProvider({ value, children }) {
  return (
    <BusinessManageContext.Provider value={{ api: businessApi, basePath: "/dashboard", business: null, isAdminManaging: false, ...value }}>
      {children}
    </BusinessManageContext.Provider>
  );
}

export function useBusinessManage() {
  const context = useContext(BusinessManageContext);
  const location = useLocation();
  const adminMatch =
    matchPath("/admin/businesses/:businessId/control/*", location.pathname) ||
    matchPath("/admin/businesses/:businessId/control", location.pathname);

  return useMemo(() => {
    if (!context.isAdminManaging && adminMatch?.params?.businessId) {
      const businessId = adminMatch.params.businessId;
      return {
        ...context,
        api: adminManagedBusinessApi(businessId),
        basePath: `/admin/businesses/${businessId}/control`,
        isAdminManaging: true,
      };
    }
    return context;
  }, [context, adminMatch?.params?.businessId]);
}
