import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Area, Line, Bar, BarChart, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Download, Star, ArrowUpDown } from "lucide-react";
import AdminSidebar from "../../components/AdminSidebar";
import { api } from "../../lib/api";
import "./Analytics.css";
import "./AdminExtras.css";

const RANGE_OPTIONS = ["This Week", "This Month", "Last 30 Days", "This Quarter", "This Year", "Custom"];
const COLORS = ["#1F4D3D", "#4C9A83", "#E8935C", "#E7DFCC", "#8A8471"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
const fmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function getDateRange(range) {
  const t = new Date();
  if (range === "This Week") {
    const diff = t.getDay() === 0 ? -6 : 1 - t.getDay();
    const s = new Date(t); s.setDate(t.getDate() + diff);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { startDate: fmtISO(s), endDate: fmtISO(e) };
  }
  if (range === "Last 30 Days") {
    const s = new Date(t); s.setDate(t.getDate() - 29);
    return { startDate: fmtISO(s), endDate: fmtISO(t) };
  }
  if (range === "This Quarter") {
    const m = Math.floor(t.getMonth() / 3) * 3;
    return { startDate: fmtISO(new Date(t.getFullYear(), m, 1)), endDate: fmtISO(new Date(t.getFullYear(), m + 3, 0)) };
  }
  if (range === "This Year") {
    return { startDate: fmtISO(new Date(t.getFullYear(), 0, 1)), endDate: fmtISO(new Date(t.getFullYear(), 11, 31)) };
  }
  return { startDate: fmtISO(new Date(t.getFullYear(), t.getMonth(), 1)), endDate: fmtISO(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
}

const chartDate = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "");

function formatDelta(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "No previous data";
  return `${Math.abs(Number(value)).toFixed(1)}% vs last period`;
}

function StatCard({ label, value, delta, positive = true, loading }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{loading ? "Loading..." : value}</span>
      <span className={`stat-card__delta ${positive ? "is-positive" : "is-negative"}`}>
        {loading ? "" : delta === undefined ? null : `${positive ? "↑" : "↓"} ${delta}`}
      </span>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState("This Month");
  const initial = useMemo(() => getDateRange("This Month"), []);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPrev, setShowPrev] = useState(true);
  const [sort, setSort] = useState({ key: "revenue", dir: "desc" });

  const load = useCallback(async () => {
    if (startDate > endDate) return;
    try {
      setLoading(true);
      setError("");
      setAnalytics(await api(`/admin/analytics?${new URLSearchParams({ startDate, endDate })}`));
    } catch (err) {
      setError(err?.message || "Unable to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  function handleRangeChange(option) {
    setRange(option);
    if (option !== "Custom") {
      const d = getDateRange(option);
      setStartDate(d.startDate);
      setEndDate(d.endDate);
    }
  }

  const s = analytics?.summary;
  const cmp = analytics?.comparison || {};
  const revPar = s ? (Number(s.adr || 0) * Number(s.occupancy || 0)) / 100 : 0;

  const revenueTrend = useMemo(() => {
    const prev = analytics?.revenueTrendPrev || [];
    return (analytics?.revenueTrend || []).map((it, i) => ({
      ...it,
      day: chartDate(it.date),
      prev: prev[i]?.revenue,
    }));
  }, [analytics]);
  const hasPrev = revenueTrend.some((r) => r.prev !== undefined);

  const occupancyTrend = useMemo(
    () => (analytics?.occupancyTrend || []).map((it) => {
      const total = Number(it.occupied || 0) + Number(it.available || 0);
      return { ...it, day: chartDate(it.date), pct: total ? (Number(it.occupied || 0) / total) * 100 : 0 };
    }),
    [analytics]
  );

  // Average revenue per weekday, derived from the daily trend (no backend change needed).
  const weekdayData = useMemo(() => {
    const buckets = WEEKDAYS.map((name) => ({ name, sum: 0, n: 0 }));
    (analytics?.revenueTrend || []).forEach((it) => {
      const idx = (new Date(`${it.date}T00:00:00`).getDay() + 6) % 7;
      buckets[idx].sum += Number(it.revenue || 0);
      buckets[idx].n += 1;
    });
    return buckets.map((b) => ({ name: b.name, revenue: b.n ? Math.round(b.sum / b.n) : 0 }));
  }, [analytics]);

  const insights = useMemo(() => {
    const list = [];
    const best = [...weekdayData].sort((a, b) => b.revenue - a.revenue)[0];
    if (best && best.revenue > 0) list.push({ k: "Strongest weekday", v: `${best.name} averages ${peso(best.revenue)} in revenue.` });
    const peak = [...revenueTrend].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];
    if (peak && Number(peak.revenue) > 0) list.push({ k: "Peak day", v: `${peak.day} brought in ${peso(peak.revenue)}.` });
    const low = [...occupancyTrend].sort((a, b) => a.pct - b.pct)[0];
    if (low && occupancyTrend.length > 1) list.push({ k: "Quietest day", v: `${low.day} had only ${low.pct.toFixed(0)}% occupancy. A good day for a promo.` });
    if (s && Number(s.cancellationRate) >= 15) list.push({ k: "Watch out", v: `Cancellations are at ${Number(s.cancellationRate).toFixed(1)}%. Consider a deposit or a stricter window.` });
    return list;
  }, [weekdayData, revenueTrend, occupancyTrend, s]);

  const revenueByRoomType = (analytics?.revenueByRoomType || []).map((it, i) => ({ ...it, accent: COLORS[i % COLORS.length] }));
  const paymentMethods = (analytics?.paymentMethods || []).map((it, i) => ({ name: it.name, value: Number(it.value || 0), color: COLORS[i % COLORS.length] }));
  const paymentTotal = paymentMethods.reduce((a, b) => a + b.value, 0);

  const topRooms = useMemo(() => {
    const rows = [...(analytics?.topRooms || [])];
    rows.sort((a, b) => {
      const av = sort.key === "name" ? a.name : Number(a[sort.key] || 0);
      const bv = sort.key === "name" ? b.name : Number(b[sort.key] || 0);
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
    return rows;
  }, [analytics, sort]);

  function toggleSort(key) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  function exportReport() {
    if (!analytics) return;
    const rows = [
      ["Metric", "Value"],
      ["Period", `${startDate} to ${endDate}`],
      ["Total Revenue", s.revenue],
      ["Occupancy Rate", `${s.occupancy}%`],
      ["Average Daily Rate", s.adr],
      ["RevPAR", revPar.toFixed(2)],
      ["Total Bookings", s.bookings],
      ["Cancellation Rate", `${s.cancellationRate}%`],
      [],
      ["Date", "Revenue", "Occupied", "Available"],
      ...(analytics.revenueTrend || []).map((r, i) => [r.date, r.revenue, analytics.occupancyTrend?.[i]?.occupied ?? "", analytics.occupancyTrend?.[i]?.available ?? ""]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `stayease-analytics-${startDate}-${endDate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const axis = { fontSize: 11, fill: "#7A7566" };
  const pos = (v) => Number(v || 0) >= 0;

  return (
    <div className="analytics-layout">
      <AdminSidebar activeKey="analytics" />

      <main className={`analytics-page ${loading && analytics ? "dx-skeleton" : ""}`}>
        <header className="analytics-header">
          <div>
            <h1>Analytics Dashboard</h1>
            <p>Occupancy performance and financial trends · {chartDate(startDate)} – {chartDate(endDate)}</p>
          </div>

          <div className="analytics-header__controls">
            <div className="range-tabs" role="tablist" aria-label="Date range">
              {RANGE_OPTIONS.map((o) => (
                <button key={o} role="tab" aria-selected={range === o} className={`range-tab ${range === o ? "is-active" : ""}`} onClick={() => handleRangeChange(o)}>
                  {o}
                </button>
              ))}
            </div>
            {range === "Custom" && (
              <>
                <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </>
            )}
            <button className="export-btn" onClick={exportReport} disabled={!analytics}>
              <Download size={16} /> Export Report
            </button>
          </div>
        </header>

        {error && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 20, color: "#c9573f", border: "1px solid #ead5ce" }}>
            {error} <button type="button" onClick={load} style={{ marginLeft: 8, border: 0, background: "none", textDecoration: "underline", cursor: "pointer", color: "inherit" }}>Retry</button>
          </div>
        )}

        <section className="stat-grid">
          <StatCard loading={loading && !analytics} label="TOTAL REVENUE" value={peso(s?.revenue)} delta={formatDelta(cmp.revenue)} positive={pos(cmp.revenue)} />
          <StatCard loading={loading && !analytics} label="OCCUPANCY RATE" value={`${Number(s?.occupancy || 0).toFixed(1)}%`} delta={formatDelta(cmp.occupancy)} positive={pos(cmp.occupancy)} />
          <StatCard loading={loading && !analytics} label="AVG DAILY RATE (ADR)" value={peso(s?.adr)} delta={formatDelta(cmp.adr)} positive={pos(cmp.adr)} />
          <StatCard loading={loading && !analytics} label="REVPAR" value={peso(revPar)} delta={undefined} />
          <StatCard loading={loading && !analytics} label="TOTAL BOOKINGS" value={Number(s?.bookings || 0).toLocaleString()} delta={formatDelta(cmp.bookings)} positive={pos(cmp.bookings)} />
          <StatCard loading={loading && !analytics} label="CANCELLATION RATE" value={`${Number(s?.cancellationRate || 0).toFixed(1)}%`} delta={formatDelta(cmp.cancellationRate)} positive={Number(cmp.cancellationRate || 0) <= 0} />
        </section>

        {insights.length > 0 && (
          <section className="dx-insights">
            {insights.map((i) => (
              <div className="dx-insight" key={i.k}><small>{i.k}</small>{i.v}</div>
            ))}
          </section>
        )}

        <section className="chart-grid">
          <div className="panel">
            <div className="panel__header">
              <h2>Revenue Trend</h2>
              {hasPrev && (
                <label className="dx-toggle">
                  <input type="checkbox" checked={showPrev} onChange={(e) => setShowPrev(e.target.checked)} /> Previous period
                </label>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#efe9db" />
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip formatter={(v) => peso(v)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1F4D3D" strokeWidth={2.5} fill="#4C9A83" fillOpacity={0.18} />
                {hasPrev && showPrev && <Line type="monotone" dataKey="prev" name="Previous period" stroke="#8A8471" strokeDasharray="5 4" dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div className="panel__header">
              <h2>Occupancy Trend</h2>
              <div className="legend-inline">
                <span className="legend-dot legend-dot--orange">Occupied</span>
                <span className="legend-dot legend-dot--teal">Available</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={occupancyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#efe9db" />
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rooms" hide />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v, n) => (n === "Occupancy %" ? `${Number(v).toFixed(0)}%` : v)} />
                <Bar yAxisId="rooms" stackId="r" dataKey="occupied" name="Occupied" fill="#E8935C" barSize={14} />
                <Bar yAxisId="rooms" stackId="r" dataKey="available" name="Available" fill="#4C9A83" fillOpacity={0.55} radius={[4, 4, 0, 0]} barSize={14} />
                <Line yAxisId="pct" type="monotone" dataKey="pct" name="Occupancy %" stroke="#1F4D3D" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-grid">
          <div className="panel">
            <div className="panel__header"><h2>Revenue by Day of Week</h2><span className="dx-sub">Daily average</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => peso(v)} cursor={{ fill: "rgba(0,0,0,.04)" }} />
                <Bar dataKey="revenue" name="Avg revenue" radius={[6, 6, 0, 0]} barSize={26}>
                  {weekdayData.map((d, i) => (
                    <Cell key={d.name} fill={d.revenue === Math.max(...weekdayData.map((x) => x.revenue)) && d.revenue > 0 ? "#E8935C" : "#1F4D3D"} fillOpacity={i > 4 ? 0.75 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div className="panel__header"><h2>Revenue by Room Type</h2></div>
            <div className="room-revenue-list">
              {revenueByRoomType.length === 0 ? (
                <p style={{ color: "#8a8471", fontSize: 13 }}>No room revenue data for this period.</p>
              ) : (
                revenueByRoomType.map((room) => {
                  const max = Math.max(...revenueByRoomType.map((r) => Number(r.revenue) || 0), 1);
                  const width = Math.max(8, Math.round((room.revenue / max) * 100));
                  return (
                    <div className="room-revenue-row" key={room.name}>
                      <div className="room-revenue-row__top"><span>{room.name}</span><span>{peso(room.revenue)}</span></div>
                      <div className="room-revenue-row__track">
                        <div className="room-revenue-row__fill" style={{ width: `${width}%`, background: room.accent }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="chart-grid">
          <div className="panel">
            <div className="panel__header"><h2>Payment Method Breakdown</h2></div>
            <div className="donut-panel">
              <div className="donut-wrap">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="value" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
                      {paymentMethods.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{s?.bookings || 0}</strong><span>Bookings</span></div>
              </div>
              <ul className="donut-legend">
                {paymentMethods.map((m) => (
                  <li key={m.name}>
                    <span className="dot" style={{ background: m.color }} />
                    <span className="donut-legend__name">{m.name}</span>
                    <span className="donut-legend__value">{paymentTotal ? Math.round((m.value / paymentTotal) * 100) : 0}% ({m.value})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Optional panels: render only when the API sends the data. */}
          {(analytics?.bookingSources || []).length > 0 && (
            <div className="panel">
              <div className="panel__header"><h2>Booking Sources</h2></div>
              <div className="room-revenue-list">
                {analytics.bookingSources.map((src, i) => {
                  const max = Math.max(...analytics.bookingSources.map((x) => x.value), 1);
                  return (
                    <div className="room-revenue-row" key={src.name}>
                      <div className="room-revenue-row__top"><span>{src.name}</span><span>{src.value}</span></div>
                      <div className="room-revenue-row__track"><div className="room-revenue-row__fill" style={{ width: `${(src.value / max) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {((analytics?.lengthOfStay || []).length > 0 || (analytics?.leadTime || []).length > 0) && (
          <section className="chart-grid">
            {[["Length of Stay", analytics?.lengthOfStay], ["Booking Lead Time", analytics?.leadTime]].map(([title, data]) =>
              data?.length ? (
                <div className="panel" key={title}>
                  <div className="panel__header"><h2>{title}</h2><span className="dx-sub">Bookings</span></div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
                      <Bar dataKey="count" name="Bookings" fill="#4C9A83" radius={[6, 6, 0, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null
            )}
          </section>
        )}

        <section className="panel">
          <div className="panel__header"><h2>Top Performing Rooms</h2></div>
          <table className="rooms-table">
            <thead>
              <tr>
                {[["name", "Room Name"], ["bookings", "Bookings Count"], ["revenue", "Revenue Generated"], ["occupancy", "Occupancy %"]].map(([key, label]) => (
                  <th key={key} className="dx-sort" onClick={() => toggleSort(key)}>
                    {label} <ArrowUpDown size={11} style={{ opacity: sort.key === key ? 1 : 0.35 }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topRooms.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#8a8471" }}>No room performance data for this period.</td></tr>
              ) : (
                topRooms.map((room) => (
                  <tr key={room.id || room.name}>
                    <td>{room.popular && <Star size={14} className="star-icon" />}{room.name}</td>
                    <td>{room.bookings}</td>
                    <td className="cell-revenue">{peso(room.revenue)}</td>
                    <td>{Number(room.occupancy || 0).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}