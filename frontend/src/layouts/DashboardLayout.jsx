import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { LanguageSwitcher } from "../components/GlobalControls.jsx";
import { BellIcon } from "../components/Icons.jsx";
import { adminFavicon, setFavicon } from "../favicon.js";
import { applyBrandTheme, resetBrandTheme } from "../brandTheme.js";
import { businessApi } from "../api/endpoints.js";

const NAV = {
  SUPER_ADMIN: [
    { to: "/admin", icon: "▦", labelKey: "navDashboard", end: true },
    { to: "/admin/statistics", icon: "▥", labelKey: "navStatistics" },
    { to: "/admin/businesses", icon: "▣", labelKey: "navBusinesses" },
    { to: "/admin/managers", icon: "◉", labelKey: "navManagers" },
  ],
  BUSINESS_OWNER: [
    { to: "/dashboard", icon: "▦", labelKey: "navDashboard", end: true },
    { to: "/dashboard/statistics", icon: "▥", labelKey: "navStatistics" },
    { to: "/dashboard/customers", icon: "◎", labelKey: "navCustomers", requiresCustomerHub: true },
    {
      to: "/dashboard/appointments",
      icon: "□",
      labelKey: "navAppointments",
      children: [
        { to: "/dashboard/appointments", labelKey: "navAppointments", end: true },
        { to: "/dashboard/appointments/manage", labelKey: "navAppointmentsManagement" },
        { to: "/dashboard/appointments/rejected", labelKey: "navRejectedAppointments" },
      ],
    },
    { to: "/dashboard/services", icon: "◇", labelKey: "navServices" },
    { to: "/dashboard/employees", icon: "◉", labelKey: "navEmployees" },
    {
      to: "/dashboard/accounts",
      icon: "₪",
      labelKey: "navAccounts",
      children: [
        { to: "/dashboard/accounts", labelKey: "navAccountsOverview", end: true },
        { to: "/dashboard/accounts/payments", labelKey: "navAppointmentPayments" },
      ],
    },
    { to: "/dashboard/working-hours", icon: "◷", labelKey: "navWorkingHours" },
    { to: "/dashboard/subscription", icon: "◇", labelKey: "navSubscription" },
    { to: "/dashboard/activity", icon: "☷", labelKey: "navActivity" },
    { to: "/dashboard/settings", icon: "⚙", labelKey: "navSettings" },
  ],
  STAFF: [
    { to: "/staff", icon: "□", labelKey: "navStaffAppointments", end: true },
    { to: "/staff/queue", icon: "☷", labelKey: "navQueueManagement", requiresSecretary: true },
    { to: "/staff/accounts", icon: "₪", labelKey: "navAccounts", requiresSecretary: true },
  ],
};
const ROLE_KEY = {
  SUPER_ADMIN: "roleSuperAdmin",
  BUSINESS_OWNER: "roleBusinessOwner",
  STAFF: "roleStaff",
};

const mojibakePattern = /[ן¢׳´׳³׳’ֲֲֲ׳ ]/;

function cleanNotificationMessage(item) {
  const message = item?.message || "";
  if (message && !mojibakePattern.test(message)) return message;
  if (item?.type === "NEW_APPOINTMENT") return "وصل حجز جديد إلى النظام";
  if (item?.type === "CUSTOMER") return "تحديث على حالة الحجز";
  return "إشعار من النظام";
}

function getAudioContext(audioContextRef) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContextRef.current) audioContextRef.current = new AudioContext();
  return audioContextRef.current;
}

function unlockNotificationSound(audioContextRef) {
  const ctx = getAudioContext(audioContextRef);
  if (!ctx) return;
  ctx.resume?.().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.02);
}

function playNewAppointmentSound(audioContextRef) {
  const ctx = getAudioContext(audioContextRef);
  if (!ctx) return;

  ctx.resume?.().catch(() => {});
  const startAt = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(0.18, startAt + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.95);
  master.connect(ctx.destination);

  [
    { start: 0, freq: 740 },
    { start: 0.28, freq: 988 },
    { start: 0.56, freq: 1244 },
    { start: 1.1, freq: 988 },
  ].forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, startAt + note.start);
    gain.gain.setValueAtTime(0.0001, startAt + note.start);
    gain.gain.exponentialRampToValueAtTime(0.55, startAt + note.start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.start + 0.45);
    osc.connect(gain);
    gain.connect(master);
    osc.start(startAt + note.start);
    osc.stop(startAt + note.start + 0.5);
  });

  setTimeout(() => master.disconnect(), 2200);
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sidebarClosed, setSidebarClosed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const knownNotificationIds = useRef(new Set());
  const notificationsInitialized = useRef(false);
  const audioContextRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const location = useLocation();
  const links = (NAV[user?.role] || []).filter((link) => {
    if (link.requiresPrintScreen && !user?.business?.printScreenEnabled) return false;
    if (link.requiresCustomerHub && !user?.business?.customerHubEnabled) return false;
    if (link.requiresSecretary && user?.staffRole !== "SECRETARY") return false;
    return true;
  });
  const flatLinks = links.flatMap((link) => [link, ...(link.children || [])]);
  const isAdmin = user?.role === "SUPER_ADMIN";
  const logoSrc = isAdmin ? "/oh-tech-logo.jpg" : user?.business?.logoUrl || "/oh-tech-logo.jpg";
  const roleKey = ROLE_KEY[user?.role] || "roleStaff";
  const staffJobTitle = user?.employeeProfile?.title?.trim();
  const roleLabel =
    user?.role === "STAFF"
      ? staffJobTitle || (user?.staffRole === "SECRETARY" ? "قسم سكرتارية" : "مقدم خدمة")
      : t(roleKey);

  useEffect(() => {
    if (isAdmin) {
      adminFavicon();
      resetBrandTheme();
    } else {
      setFavicon(user?.business?.logoUrl || "/oh-tech-logo.jpg");
      applyBrandTheme(user?.business?.brandColor);
    }
    return () => {
      resetBrandTheme();
      adminFavicon();
    };
  }, [isAdmin, user?.business?.logoUrl, user?.business?.brandColor]);

  const currentLabelKey =
    flatLinks
      .slice()
      .sort((a, b) => b.to.length - a.to.length)
      .find((link) => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)))
      ?.labelKey || "navDashboard";
  const unreadNotifications = notifications.filter((item) => !item.isRead);

  const loadNotifications = () => {
    if (user?.role !== "BUSINESS_OWNER") return;
    businessApi.notifications().then((r) => {
      const nextNotifications = r.notifications || [];
      const newAppointment = nextNotifications.find(
        (item) => item.type === "NEW_APPOINTMENT" && !knownNotificationIds.current.has(item.id)
      );
      if (notificationsInitialized.current && newAppointment) {
        try {
          playNewAppointmentSound(audioContextRef);
        } catch {
          // Browsers may block sound until the user interacts with the page.
        }
      }
      knownNotificationIds.current = new Set(nextNotifications.map((item) => item.id));
      notificationsInitialized.current = true;
      setNotifications(nextNotifications);
    }).catch(() => setNotifications([]));
  };

  const markAllNotificationsRead = async () => {
    await businessApi.markNotificationsRead();
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
  };

  const deleteAllNotifications = async () => {
    await businessApi.deleteNotifications();
    knownNotificationIds.current = new Set();
    setNotifications([]);
  };

  useEffect(() => {
    loadNotifications();
    if (user?.role !== "BUSINESS_OWNER") return undefined;
    const timer = setInterval(loadNotifications, 4000);
    return () => clearInterval(timer);
  }, [location.pathname, user?.role]);

  useEffect(() => {
    if (user?.role !== "BUSINESS_OWNER") return undefined;
    const unlock = () => unlockNotificationSound(audioContextRef);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [user?.role]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!notificationsMenuRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, [notificationsOpen]);

  return (
    <div className={`shell ${sidebarClosed ? "sidebar-closed" : ""}`}>
      <div className={`scrim ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            {logoSrc ? <img src={logoSrc} alt={isAdmin ? "O&H Tech" : user?.business?.name || t("storeLogo")} /> : <span>OH</span>}
          </div>
          <div>
            <div className="brand-name">{isAdmin ? "O&H Tech" : user?.business?.name || t("businessPlatform")}</div>
            <div className="brand-sub">{isAdmin ? t("adminBrandSub") : t("businessBrandSub")}</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">{t("mainMenu")}</div>
          {links.map((link) => {
            const submenuOpen = link.children?.length && location.pathname.startsWith(link.to);
            return (
              <div key={link.to} className={submenuOpen ? "nav-group open" : "nav-group"}>
                {link.children?.length ? (
                  <button type="button" className={`nav-link nav-link-group-title ${submenuOpen ? "active" : ""}`}>
                    <span className="nav-ico">{link.icon}</span>
                    {t(link.labelKey)}
                  </button>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="nav-ico">{link.icon}</span>
                    {t(link.labelKey)}
                  </NavLink>
                )}
                {submenuOpen && (
                  <div className="nav-submenu">
                    {link.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) => `nav-sub-link ${isActive ? "active" : ""}`}
                        onClick={() => setOpen(false)}
                      >
                        {t(child.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          {user?.business && (
            <div className="user-chip" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>▣</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.business.name}
                </div>
              </div>
            </div>
          )}
          <div className="user-chip">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name}
              </div>
              <div className="soft" style={{ fontSize: 12 }}>{roleLabel}</div>
            </div>
            <button className="icon-btn" title={t("logout")} onClick={logout}>↩</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row topbar-main">
            <button
              className="burger"
              onClick={() => {
                setOpen((value) => !value);
                setSidebarClosed((value) => !value);
              }}
              aria-label={sidebarClosed ? t("openSidebar") : t("closeSidebar")}
              title={sidebarClosed ? t("openSidebar") : t("closeSidebar")}
            >☰</button>
            <div className="topbar-title">{t(currentLabelKey)}</div>
          </div>
          <div className="row topbar-actions">
            <LanguageSwitcher className="topbar-language-switcher" />
            {user?.role === "BUSINESS_OWNER" && (
              <div className="notifications-menu" ref={notificationsMenuRef}>
                <button
                  className="btn btn-ghost notification-bell"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  aria-label={t("notifications")}
                  title={t("notifications")}
                >
                  <BellIcon />
                  {unreadNotifications.length ? <span className="notification-count">{unreadNotifications.length}</span> : null}
                </button>
                {notificationsOpen && (
                  <div className="notifications-popover">
                    <div className="row-between" style={{ marginBottom: 8, gap: 8 }}>
                      <div style={{ fontWeight: 800 }}>{t("notifications")}</div>
                      {notifications.length ? (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={markAllNotificationsRead}>{t("markRead")}</button>
                          <button className="btn btn-ghost btn-sm" onClick={deleteAllNotifications}>{t("deleteAll")}</button>
                        </div>
                      ) : null}
                    </div>
                    {notifications.length ? notifications.map((item) => (
                      <div key={item.id} className={`notification-row ${item.isRead ? "is-read" : ""}`}>
                        <span>{cleanNotificationMessage(item)}</span>
                      </div>
                    )) : (
                      <div className="soft" style={{ fontSize: 13 }}>{t("noNotifications")}</div>
                    )}
                  </div>
                )}
              </div>
            )}
            <span className="badge badge-primary hide-mobile">
              <span className="dot" /> {roleLabel}
            </span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
