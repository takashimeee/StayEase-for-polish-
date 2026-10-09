import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  List as ListIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  UserRound,
  Search,
  RefreshCw,
  X,
} from "lucide-react";
import AdminSidebar from "../../components/AdminSidebar";
import { api } from "../../lib/api";
import "./Housekeeping.css";

// Maps AdminSidebar's nav keys to routes. Keep in sync with AppRoutes.jsx.
const NAV_ROUTES = {
  dashboard: "/admin/dashboard",
  reservations: "/admin/reservations",
  rooms: "/admin/rooms",
  housekeeping: "/admin/housekeeping",
  analytics: "/admin/analytics",
  settings: "/admin/settings",
};

const POLL_MS = 30000;
const STATUS_ORDER = ["dirty", "in-progress", "clean-ready", "inspected"];
const STATUS_META = {
  dirty: { label: "Dirty", accent: "#D97757" },
  "in-progress": { label: "In Progress", accent: "#4C9A83" },
  "clean-ready": { label: "Clean / Ready", accent: "#1F4D3D" },
  inspected: { label: "Inspected", accent: "#8A8471" },
};

function shiftStatus(status, delta) {
  const idx = STATUS_ORDER.indexOf(status);
  const next = STATUS_ORDER[idx + delta];
  return idx >= 0 && next ? next : null;
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RoomCard({ room, onOpen, onMove, onDragStart, onDragEnd, dragging }) {
  const forward = shiftStatus(room.status, 1);
  const back = shiftStatus(room.status, -1);

  return (
    <div
      className={`hk-card ${room.rush ? "hk-card--rush" : ""} ${dragging ? "is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onOpen(room)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(room);
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(room.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(room.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="hk-card__top">
        <span className="hk-card__room">{room.room}</span>
        {room.rush && (
          <span className="hk-card__rush">
            <Sparkles size={10} /> Rush
          </span>
        )}
      </div>
      <div className="hk-card__type">
        {room.type} · Floor {room.floor}
      </div>
      {room.notes && <div className="hk-card__notes" title={room.notes}>{room.notes}</div>}

      <div className="hk-card__footer">
        <span className="hk-card__assignee">
          <span className={`hk-avatar ${room.assignee ? "" : "hk-avatar--empty"}`}>
            {room.assignee ? initials(room.assignee) : <UserRound size={12} />}
          </span>
          {room.assignee || "Unassigned"}
        </span>
        <span className="hk-card__time">
          <Clock size={12} />
          {room.time}
        </span>
      </div>

      <div className="hk-card__moves">
        <button
          type="button"
          className="hk-move"
          disabled={!back}
          aria-label={back ? `Move back to ${STATUS_META[back].label}` : "Can't move back"}
          title={back ? `Back to ${STATUS_META[back].label}` : ""}
          onClick={(e) => {
            e.stopPropagation();
            back && onMove(room.id, back);
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="hk-move hk-move--forward"
          disabled={!forward}
          aria-label={forward ? `Move to ${STATUS_META[forward].label}` : "Can't move forward"}
          title={forward ? `Move to ${STATUS_META[forward].label}` : ""}
          onClick={(e) => {
            e.stopPropagation();
            forward && onMove(room.id, forward);
          }}
        >
          {forward ? STATUS_META[forward].label : "Done"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AssignHousekeeperModal({ room, housekeepers, onClose, onAssign }) {
  const [housekeeper, setHousekeeper] = useState(room.assigneeId ? String(room.assigneeId) : "");
  const [rush, setRush] = useState(!!room.rush);
  const [notes, setNotes] = useState(room.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onAssign(room.id, {
        assigneeId: housekeeper ? Number(housekeeper) : null,
        rush,
        notes,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="hk-modal__backdrop" onClick={onClose}>
      <form
        className="hk-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Assign Housekeeper</h2>
        <p className="hk-modal__subtitle">
          Room {room.room} — {room.type}
        </p>

        <label className="hk-modal__field">
          Select Housekeeper
          <select value={housekeeper} onChange={(e) => setHousekeeper(e.target.value)} autoFocus>
            <option value="">Unassigned</option>
            {housekeepers.map((hk) => (
              <option key={hk.id} value={String(hk.id)}>
                {hk.name}
              </option>
            ))}
          </select>
        </label>

        <div className="hk-modal__toggle-row">
          <div>
            <span className="hk-modal__toggle-label">
              <Sparkles size={14} /> Rush Clean
            </span>
            <span className="hk-modal__toggle-sub">Flag room for priority turn-down</span>
          </div>
          <label className="hk-switch">
            <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} />
            <span className="hk-switch__track" />
          </label>
        </div>

        <label className="hk-modal__field">
          Special Instructions
          <textarea
            rows={3}
            placeholder="Add custom requests or notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error && <p className="hk-modal__error">{error}</p>}

        <div className="hk-modal__actions">
          <button type="button" className="hk-btn hk-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="hk-btn hk-btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Housekeeping() {
  const [rooms, setRooms] = useState([]);
  const [housekeepers, setHousekeepers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [floorFilter, setFloorFilter] = useState("All Floors");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [staffFilter, setStaffFilter] = useState("all");
  const [rushOnly, setRushOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("board");
  const [activeRoom, setActiveRoom] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const pending = useRef(0);
  const navigate = useNavigate();

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await api("/admin/housekeeping");
      // Don't overwrite optimistic changes that are still in flight.
      if (pending.current > 0) return;
      setRooms(data.rooms);
      setHousekeepers(data.housekeepers);
      setLoadError("");
      setLastSync(new Date());
    } catch (err) {
      if (!silent) setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => !document.hidden && load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const types = useMemo(() => [...new Set(rooms.map((r) => r.type))].sort(), [rooms]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (floorFilter !== "All Floors" && room.floor !== Number(floorFilter)) return false;
      if (typeFilter !== "All Types" && room.type !== typeFilter) return false;
      if (rushOnly && !room.rush) return false;
      if (staffFilter === "unassigned" && room.assigneeId) return false;
      if (staffFilter !== "all" && staffFilter !== "unassigned" && String(room.assigneeId) !== staffFilter)
        return false;
      if (q && !`${room.room} ${room.type} ${room.assignee || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rooms, floorFilter, typeFilter, rushOnly, staffFilter, search]);

  const counts = useMemo(() => {
    const base = { dirty: 0, "in-progress": 0, "clean-ready": 0, inspected: 0 };
    rooms.forEach((r) => (base[r.status] = (base[r.status] || 0) + 1));
    return base;
  }, [rooms]);

  const workload = useMemo(() => {
    const map = {};
    rooms.forEach((r) => {
      if (r.assigneeId && r.status !== "inspected" && r.status !== "clean-ready") {
        map[r.assigneeId] = (map[r.assigneeId] || 0) + 1;
      }
    });
    return map;
  }, [rooms]);

  const rushCount = rooms.filter((r) => r.rush && r.status === "dirty").length;

  async function handleMove(id, status) {
    const original = rooms.find((r) => r.id === id);
    if (!original || original.status === status) return;

    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, status, time: "0m" } : r)));
    pending.current++;
    try {
      const updated = await api(`/admin/housekeeping/${id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setRooms((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      // Roll back only this room.
      setRooms((prev) => prev.map((r) => (r.id === id ? original : r)));
      showToast(`Couldn't move room ${original.room}: ${err.message}`);
    } finally {
      pending.current--;
    }
  }

  // Throws on failure so the modal can show the error and stay open.
  async function handleAssign(id, updates) {
    const updated = await api(`/admin/housekeeping/${id}/assign`, { method: "PATCH", body: updates });
    setRooms((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setActiveRoom(null);
  }

  function handleNavigate(key) {
    const path = NAV_ROUTES[key];
    if (!path) {
      console.warn(`[Housekeeping] Unknown sidebar key: "${key}". Add it to NAV_ROUTES.`);
      showToast(`"${key}" page isn't linked yet.`);
      return;
    }
    navigate(path);
  }

  function handleDrop(e, statusKey) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain")) || draggingId;
    setOverColumn(null);
    setDraggingId(null);
    if (id) handleMove(id, statusKey);
  }

  return (
    <div className="hk-layout">
      <AdminSidebar activeKey="housekeeping" onNavigate={handleNavigate} />

      <main className="hk-page">
        <header className="hk-header">
          <div>
            <h1>Room Status Board</h1>
            <p>
              Real-time monitoring and task assignment for resort-wide operations
              {lastSync && <span className="hk-sync"> · Updated {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>

          <div className="hk-header__controls">
            <button type="button" className="hk-btn hk-btn--ghost hk-btn--icon" onClick={() => load()} title="Refresh now">
              <RefreshCw size={14} />
            </button>
            <div className="hk-view-toggle">
              <button type="button" className={view === "board" ? "is-active" : ""} onClick={() => setView("board")}>
                <LayoutGrid size={14} /> Board
              </button>
              <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>
                <ListIcon size={14} /> List
              </button>
            </div>
          </div>
        </header>

        <section className="hk-stats">
          <div className="hk-stat">
            <span className="hk-stat__label">TOTAL ROOMS</span>
            <span className="hk-stat__value">{rooms.length}</span>
          </div>
          {STATUS_ORDER.map((key) => (
            <div className="hk-stat" key={key}>
              <span className="hk-stat__label" style={{ color: STATUS_META[key].accent }}>
                {STATUS_META[key].label.toUpperCase()}
              </span>
              <span className="hk-stat__value" style={{ color: STATUS_META[key].accent }}>
                {counts[key]}
              </span>
            </div>
          ))}
        </section>

        <section className="hk-toolbar">
          <div className="hk-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search room, type, or staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="hk-select">
            <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
              <option>All Floors</option>
              {floors.map((f) => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>

          <div className="hk-select">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option>All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>

          <div className="hk-select">
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="all">All Staff</option>
              <option value="unassigned">Unassigned</option>
              {housekeepers.map((hk) => (
                <option key={hk.id} value={String(hk.id)}>
                  {hk.name}{workload[hk.id] ? ` (${workload[hk.id]})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>

          <button
            type="button"
            className={`hk-chip ${rushOnly ? "is-active" : ""}`}
            onClick={() => setRushOnly((v) => !v)}
          >
            <Sparkles size={12} /> Rush only{rushCount > 0 && ` (${rushCount})`}
          </button>
        </section>

        {loading ? (
          <p className="hk-state">Loading rooms...</p>
        ) : loadError ? (
          <div className="hk-state hk-state--error">
            <p>{loadError}</p>
            <button type="button" className="hk-btn hk-btn--small" onClick={() => { setLoading(true); load(); }}>
              Retry
            </button>
          </div>
        ) : view === "board" ? (
          <section className="hk-board">
            {STATUS_ORDER.map((statusKey) => {
              const meta = STATUS_META[statusKey];
              const columnRooms = filteredRooms
                .filter((r) => r.status === statusKey)
                .sort((a, b) => Number(!!b.rush) - Number(!!a.rush)); // rush first
              return (
                <div
                  className={`hk-column ${overColumn === statusKey ? "is-over" : ""}`}
                  key={statusKey}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverColumn(statusKey);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setOverColumn(null);
                  }}
                  onDrop={(e) => handleDrop(e, statusKey)}
                >
                  <div className="hk-column__header" style={{ borderColor: meta.accent }}>
                    <span style={{ color: meta.accent }}>{meta.label}</span>
                    <span className="hk-column__count">{columnRooms.length}</span>
                  </div>
                  <div className="hk-column__list">
                    {columnRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        dragging={draggingId === room.id}
                        onOpen={setActiveRoom}
                        onMove={handleMove}
                        onDragStart={setDraggingId}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverColumn(null);
                        }}
                      />
                    ))}
                    {columnRooms.length === 0 && <div className="hk-column__empty">Drop rooms here</div>}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="hk-list-panel">
            <table className="hk-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Floor</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      {room.room}
                      {room.rush && <span className="hk-card__rush hk-card__rush--inline">Rush</span>}
                    </td>
                    <td>{room.type}</td>
                    <td>{room.floor}</td>
                    <td>
                      <select
                        className="hk-status-select"
                        value={room.status}
                        style={{ color: STATUS_META[room.status].accent, borderColor: STATUS_META[room.status].accent }}
                        onChange={(e) => handleMove(room.id, e.target.value)}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td>{room.assignee || "Unassigned"}</td>
                    <td>{room.time}</td>
                    <td>
                      <button type="button" className="hk-btn hk-btn--small" onClick={() => setActiveRoom(room)}>
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRooms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="hk-list-empty">No rooms match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {toast && (
        <div className="hk-toast" role="alert">
          {toast}
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss"><X size={12} /></button>
        </div>
      )}

      {activeRoom && (
        <AssignHousekeeperModal
          room={activeRoom}
          housekeepers={housekeepers}
          onClose={() => setActiveRoom(null)}
          onAssign={handleAssign}
        />
      )}
    </div>
  );
}