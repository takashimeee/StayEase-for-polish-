import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import {
  Search, Bell, TrendingUp, Calendar, Percent, DoorOpen, BedDouble,
  AlertTriangle, ArrowRight, RefreshCw, Plus, CheckCircle2,
} from "lucide-react";
import AdminSidebar from "../../components/AdminSidebar";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import "./Dashboard.css";
import "./AdminExtras.css";

const STATUS_STYLES = {
  Confirmed: { bg: "#E4F2E8", color: "#1F4D3D" },
  "Checked-in": { bg: "#E4EEF8", color: "#2C5F8A" },
  Pending: { bg: "#FBF0DA", color: "#B5791E" },
  Cancelled: { bg: "#FCE8E3", color: "#C9573F" },
  Completed: { bg: "#E4F2E8", color: "#1F4D3D" },
};
const ROOM_MIX_COLORS = ["#1F4D3D", "#4C9A83", "#E8935C", "#2C5F8A", "#B5791E"];
const HK_META = [
  { key: "dirty", label: "Dirty", color: "#D97757" },
  { key: "in-progress", label: "In progress", color: "#4C9A83" },
  { key: "clean-ready", label: "Ready", color: "#1F4D3D" },
  { key: "inspected", label: "Inspected", color: "#8A8471" },
];
const REFRESH_MS = 60000;

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatDate(date) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatTimeAgo(value) {
  if (!value) return "";
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const firstName = (user?.fullName || user?.name || "").split(" ")[0] || "there";

  const [dashboard, setDashboard] = useState(null);
  const [hkRooms, setHkRooms] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const [data, hk] = await Promise.all([
        api("/admin/dashboard"),
        api("/admin/housekeeping").catch(() => null), // strip is optional
      ]);
      setDashboard(data);
      if (hk?.rooms) setHkRooms(hk.rooms);
    } catch (err) {
      if (!silent) setError(err?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => !document.hidden && load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const stats = dashboard?.stats ?? { checkIns: 0, checkOuts: 0, occupancy: 0, occupiedRooms: 0, totalRooms: 0, availableRooms: 0 };
  const reservations = dashboard?.todayReservations ?? [];
  const today = isoToday();

  const tabCounts = useMemo(() => ({
    all: reservations.length,
    arrivals: reservations.filter((r) => r.checkIn === today).length,
    departures: reservations.filter((r) => r.checkOut === today).length,
    inhouse: reservations.filter((r) => r.checkIn <= today && r.checkOut > today).length,
  }), [reservations, today]);

  const filteredReservations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (tab === "arrivals" && r.checkIn !== today) return false;
      if (tab === "departures" && r.checkOut !== today) return false;
      if (tab === "inhouse" && !(r.checkIn <= today && r.checkOut > today)) return false;
      return !term || [r.guest, r.room, r.status].join(" ").toLowerCase().includes(term);
    });
  }, [reservations, search, tab, today]);

  const roomMix = useMemo(
    () => (dashboard?.roomMix ?? []).map((item, i) => ({ ...item, color: ROOM_MIX_COLORS[i % ROOM_MIX_COLORS.length] })),
    [dashboard]
  );
  const occupancyChart = useMemo(
    () => [
      { value: stats.occupancy, color: "#1F4D3D" },
      { value: Math.max(100 - stats.occupancy, 0), color: "#EFE9DB" },
    ],
    [stats.occupancy]
  );

  const hk = useMemo(() => {
    const counts = { dirty: 0, "in-progress": 0, "clean-ready": 0, inspected: 0 };
    hkRooms.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
    const total = hkRooms.length;
    const ready = counts["clean-ready"] + counts.inspected;
    return { counts, total, ready, pct: total ? Math.round((ready / total) * 100) : 0 };
  }, [hkRooms]);

  const alerts = useMemo(() => {
    const list = [];
    const rushDirty = hkRooms.filter((r) => r.rush && r.status === "dirty").length;
    const unassigned = hkRooms.filter((r) => r.status === "dirty" && !r.assigneeId).length;
    const pending = reservations.filter((r) => r.status === "Pending").length;
    if (rushDirty) list.push({ text: `${rushDirty} rush room${rushDirty > 1 ? "s" : ""} still dirty`, to: "/admin/housekeeping" });
    if (unassigned) list.push({ text: `${unassigned} dirty room${unassigned > 1 ? "s" : ""} with no housekeeper`, to: "/admin/housekeeping" });
    if (pending) list.push({ text: `${pending} pending reservation${pending > 1 ? "s" : ""} to confirm`, to: "/admin/reservations" });
    return list;
  }, [hkRooms, reservations]);

  const forecast = (dashboard?.forecast ?? []).map((d) => ({
    ...d,
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
  }));

  const statCards = [
    { label: "Today's Check-ins", value: stats.checkIns, icon: TrendingUp },
    { label: "Today's Check-outs", value: stats.checkOuts, icon: Calendar },
    { label: "In-house Rooms", value: stats.occupiedRooms, icon: BedDouble },
    { label: "Current Occupancy", value: `${stats.occupancy}%`, icon: Percent },
    { label: "Rooms Available", value: stats.availableRooms, icon: DoorOpen },
  ];

  return (
    <div className="dash-layout">
      <AdminSidebar activeKey="dashboard" />

      <main className="dash-page">
        <header className="dash-header">
          <div>
            <h1>Dashboard</h1>
            <p className="dx-greet">{greeting()}, {firstName}. Here's what's happening today.</p>
          </div>

          <div className="dash-header__right">
            <span className="dash-date">{todayLabel()}</span>
            <div className="dash-search">
              <Search size={14} />
              <input type="text" placeholder="Search reservations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="dash-icon-btn" title="Refresh" aria-label="Refresh" onClick={() => load()}>
              <RefreshCw size={16} />
            </button>
            <button
              className="dash-icon-btn dx-bell"
              aria-label="Alerts"
              onClick={() => document.getElementById("dx-attention")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Bell size={16} />
              {alerts.length > 0 && <span className="dx-badge">{alerts.length}</span>}
            </button>
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "#FCE8E3", color: "#C9573F", fontSize: 14 }}>
            {error}
          </div>
        )}

        <div className="dx-actions">
          <button className="dx-action" onClick={() => navigate("/admin/reservations")}><Plus size={14} /> Reservations</button>
          <button className="dx-action" onClick={() => navigate("/admin/housekeeping")}><BedDouble size={14} /> Room board</button>
          <button className="dx-action" onClick={() => navigate("/admin/analytics")}><TrendingUp size={14} /> Analytics</button>
        </div>

        <section className="dash-stats">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div className="dash-stat" key={label}>
              <div className="dash-stat__top">
                <span>{label}</span>
                <Icon size={16} className="dash-stat__icon" />
              </div>
              <span className="dash-stat__value">{loading ? "—" : value}</span>
            </div>
          ))}
        </section>

        <section className="dash-grid">
          <div className="dash-panel">
            <div className="dash-panel__header">
              <h2>Today's Reservations</h2>
              <button className="dash-link" onClick={() => navigate("/admin/reservations")}>View All</button>
            </div>

            <div className="dx-tabs">
              {[["all", "All"], ["arrivals", "Arrivals"], ["departures", "Departures"], ["inhouse", "In-house"]].map(([key, label]) => (
                <button key={key} type="button" className={`dx-tab ${tab === key ? "is-active" : ""}`} onClick={() => setTab(key)}>
                  {label} <span>{tabCounts[key]}</span>
                </button>
              ))}
            </div>

            <table className="dash-table">
              <thead>
                <tr><th>Guest Name</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6">Loading reservations...</td></tr>
                ) : filteredReservations.length === 0 ? (
                  <tr><td colSpan="6">{search || tab !== "all" ? "Nothing matches this view." : "No reservations for today."}</td></tr>
                ) : (
                  filteredReservations.map((r) => {
                    const style = STATUS_STYLES[r.status] ?? STATUS_STYLES.Pending;
                    return (
                      <tr key={r.id}>
                        <td>{r.guest}</td>
                        <td>{r.room}</td>
                        <td>{formatDate(r.checkIn)}</td>
                        <td>{formatDate(r.checkOut)}</td>
                        <td><span className="dash-badge" style={{ background: style.bg, color: style.color }}>{r.status}</span></td>
                        <td>
                          <button className="dash-link" onClick={() => navigate(`/admin/reservations?id=${r.id}`)}>View</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="dx-stack">
            <div className="dash-panel">
              <div className="dash-panel__header"><h2>Occupancy Snapshot</h2></div>
              <div className="dash-donut-wrap">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={occupancyChart} dataKey="value" innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} stroke="none">
                      {occupancyChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-donut-center">
                  <strong>{loading ? "—" : `${stats.occupancy}%`}</strong>
                  <span>Occupied</span>
                </div>
              </div>
              <div className="dash-legend">
                {roomMix.map((item) => (
                  <span key={item.name} className="dash-legend__item">
                    <span className="dot" style={{ background: item.color }} />
                    {item.name} ({item.pct}%)
                  </span>
                ))}
              </div>
              <div className="dash-panel__footnote">
                <span>Total Rooms: {stats.totalRooms}</span>
                <span>Available: {stats.availableRooms}</span>
              </div>
            </div>

            {forecast.length > 0 && (
              <div className="dash-panel">
                <div className="dash-panel__header"><h2>7-Day Forecast</h2><span className="dx-sub">Expected occupancy</span></div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={forecast} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#7A7566" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Area type="monotone" dataKey="occupancy" stroke="#1F4D3D" fill="#4C9A83" fillOpacity={0.25} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section className="dx-grid2" style={{ marginTop: 16 }}>
          <div className="dash-panel">
            <div className="dash-panel__header">
              <h2>Housekeeping Readiness</h2>
              <button className="dash-link" onClick={() => navigate("/admin/housekeeping")}>Open board</button>
            </div>
            {hk.total === 0 ? (
              <p className="dx-sub">No room status data yet.</p>
            ) : (
              <>
                <div className="dx-big">{hk.pct}% <span className="dx-sub">of rooms ready</span></div>
                <div className="dx-progress">
                  {HK_META.map((m) => (
                    <span key={m.key} title={m.label} style={{ width: `${(hk.counts[m.key] / hk.total) * 100}%`, background: m.color }} />
                  ))}
                </div>
                <div className="dx-hk-row">
                  {HK_META.map((m) => (
                    <span key={m.key}><b style={{ color: m.color }}>{hk.counts[m.key]}</b>{m.label}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="dash-panel" id="dx-attention">
            <div className="dash-panel__header"><h2>Needs Attention</h2></div>
            <ul className="dx-alerts">
              {alerts.map((a) => (
                <li key={a.text}>
                  <button type="button" className="dx-alert" onClick={() => navigate(a.to)}>
                    <AlertTriangle size={14} /> {a.text} <ArrowRight size={14} />
                  </button>
                </li>
              ))}
              {alerts.length === 0 && (
                <li className="dx-alert dx-alert--ok"><CheckCircle2 size={14} /> All clear. Nothing needs action right now.</li>
              )}
            </ul>
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel__header"><h2>Recent Activity</h2></div>
          <ul className="dash-activity">
            {(dashboard?.recentActivity ?? []).map((item) => (
              <li key={item.id}>
                <span className="dot" style={{ background: item.color }} />
                <span className="dash-activity__text">{item.text}</span>
                <span className="dash-activity__time">{formatTimeAgo(item.time)}</span>
              </li>
            ))}
            {!loading && (dashboard?.recentActivity ?? []).length === 0 && (
              <li><span className="dash-activity__text">No recent activity.</span></li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}