export function BellIcon({ size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      className="svg-icon"
    >
      <path
        fill="currentColor"
        d="M12 22a2.8 2.8 0 0 0 2.58-1.75H9.42A2.8 2.8 0 0 0 12 22Zm7-6.2-1.7-2.05V9.5a5.32 5.32 0 0 0-4.05-5.2V3.6a1.25 1.25 0 0 0-2.5 0v.7A5.32 5.32 0 0 0 6.7 9.5v4.25L5 15.8a1.2 1.2 0 0 0 .92 1.95h12.16A1.2 1.2 0 0 0 19 15.8ZM8.7 9.5a3.3 3.3 0 1 1 6.6 0v4.95l1.08 1.3H7.62l1.08-1.3V9.5Z"
      />
    </svg>
  );
}

const navIcons = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  statistics: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h17" />
      <path d="M8 15l3-4 3 2 4-6" />
      <path d="M8 19v-3" />
      <path d="M14 19v-5" />
      <path d="M20 19v-9" />
    </>
  ),
  businesses: (
    <>
      <path d="M4 20V8.5L12 4l8 4.5V20" />
      <path d="M9 20v-6h6v6" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </>
  ),
  managers: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c.7-3.6 2.8-5.4 5.5-5.4s4.8 1.8 5.5 5.4" />
      <path d="M16.5 10.5a2.5 2.5 0 1 0 0-5" />
      <path d="M17 20c1.7-.6 2.8-1.8 3.5-3.8" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.9-4.1 3.4-6.1 7-6.1s6.1 2 7 6.1" />
      <path d="M17.5 4.5l1.2 1.2 1.8-2.1" />
    </>
  ),
  appointments: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
      <path d="M8 14h4" />
      <path d="M8 17h7" />
    </>
  ),
  services: (
    <>
      <path d="M12 3.5l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.5Z" />
    </>
  ),
  employees: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16.5" cy="8" r="3" />
      <path d="M3.5 20c.6-3.6 2.4-5.4 5-5.4s4.4 1.8 5 5.4" />
      <path d="M13 15.2c1-.4 2.1-.6 3.5-.6 2.6 0 4.4 1.8 5 5.4" />
    </>
  ),
  accounts: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M8 9h8" />
      <path d="M8 13h3" />
      <path d="M14.5 16.5c1.3 0 2.3-.7 2.3-1.7s-1-1.5-2.2-1.5-2.2-.5-2.2-1.5 1-1.7 2.3-1.7" />
      <path d="M14.6 8.8v8.4" />
    </>
  ),
  workingHours: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3.2 2" />
      <path d="M5 4.5 3.5 6" />
      <path d="M19 4.5 20.5 6" />
    </>
  ),
  subscription: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M7.5 10h9" />
      <path d="M7.5 14h5" />
      <path d="M16 15.5l1.2 1.2 2.2-2.6" />
    </>
  ),
  activity: (
    <>
      <path d="M4 12h3l2-5 4 10 2-5h5" />
      <circle cx="5" cy="19" r="1" />
      <circle cx="12" cy="19" r="1" />
      <circle cx="19" cy="19" r="1" />
    </>
  ),
  settings: (
    <>
      <path d="M12 8.2A3.8 3.8 0 1 1 12 15.8 3.8 3.8 0 0 1 12 8.2Z" />
      <path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.8 7.8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.8 7.8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" />
    </>
  ),
  queue: (
    <>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h9" />
      <circle cx="18" cy="17" r="2.2" />
    </>
  ),
};

export function NavIcon({ name, size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      className="nav-svg-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {navIcons[name] || navIcons.dashboard}
    </svg>
  );
}
