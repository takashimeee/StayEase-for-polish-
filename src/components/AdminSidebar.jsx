import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import "./AdminSidebar.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "reservations", label: "Reservations", icon: "calendar" },
  { key: "rooms", label: "Room Management", icon: "key" },
  { key: "housekeeping", label: "Housekeeping", icon: "sparkle" },
  { key: "analytics", label: "Analytics", icon: "bars" },
  { key: "settings", label: "Settings", icon: "gear" },
];

// Keep in sync with AppRoutes.jsx.
const NAV_ROUTES = {
  dashboard: "/admin/dashboard",
  reservations: "/admin/reservations",
  rooms: "/admin/rooms",
  housekeeping: "/admin/housekeeping",
  analytics: "/admin/analytics",
  settings: "/admin/settings",
};

const ROLE_LABELS = {
  admin: "Administrator",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
  kitchen: "Kitchen",
};

function Icon({ name }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="M11 12l9-9M17 6l3 3M14 9l2.5 2.5" />
      </>
    ),
    sparkle: <path d="M12 3l1.8 5.6L19 10l-5.2 1.4L12 17l-1.8-5.6L5 10l5.2-1.4L12 3z" />,
    bars: (
      <>
        <rect x="4" y="12" width="4" height="8" />
        <rect x="10" y="7" width="4" height="13" />
        <rect x="16" y="3" width="4" height="17" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    ),
  };
  return (
    <svg
      className="admin-sidebar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function AdminSidebar({ activeKey = "rooms", onNavigate, user: userProp }) {
  const navigate = useNavigate();
  const { user: me, logout } = useApp(); // <-- check the logout name in AppContext

  const person =
    userProp ??
    (me
      ? { name: me.fullName || me.name || "Staff", role: ROLE_LABELS[me.role] || me.role || "Staff" }
      : { name: "Staff", role: "" });

  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleClick(key) {
    if (onNavigate) onNavigate(key);
    else navigate(NAV_ROUTES[key] ?? "/admin/dashboard");
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <svg viewBox="0 0 24 24" className="admin-sidebar__logo" aria-hidden="true">
          <path
            d="M4 15c2-4 4-6 8-10 4 4 6 6 8 10-2 3-4.5 5-8 5s-6-2-8-5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <span>StayEase</span>
      </div>

      <nav className="admin-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={"admin-sidebar__link" + (item.key === activeKey ? " admin-sidebar__link--active" : "")}
            onClick={() => handleClick(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__user">
          <div className="admin-sidebar__avatar">{initials}</div>
          <div>
            <div className="admin-sidebar__user-name">{person.name}</div>
            <div className="admin-sidebar__user-role">{person.role}</div>
          </div>
        </div>

        <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}