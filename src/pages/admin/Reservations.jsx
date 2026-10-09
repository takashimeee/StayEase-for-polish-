import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import { api } from "../../lib/api";
import "./Reservations.css";
import ReservationDrawer, { StatusBadge } from "./ReservationDrawer";


const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "checked-in", label: "Checked-in" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function formatDate(iso) {
  if (!iso) return "—";

  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  const ms =
    new Date(`${checkOut}T00:00:00`) -
    new Date(`${checkIn}T00:00:00`);

  return Math.max(0, Math.round(ms / 86400000));
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("checked-in");

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] =
    useState(false);

  const [selectedId, setSelectedId] =
    useState(null);

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    try {
      setLoading(true);
      setError("");

      const data = await api(
        "/admin/reservations"
      );

      setReservations(
        Array.isArray(data.reservations)
          ? data.reservations
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load reservations:",
        err
      );

      setError(
        err.message ||
          "Failed to load reservations."
      );
    } finally {
      setLoading(false);
    }
  }

  const [params] = useSearchParams();
  useEffect(() => {
    const id = params.get("id");
    if (id) { setStatusFilter("all"); setSelectedId(id); }
  }, [params]);

  const counts = useMemo(() => {
    const c = {
      all: reservations.length,
      upcoming: 0,
      "checked-in": 0,
      completed: 0,
      cancelled: 0,
    };

    reservations.forEach((r) => {
      if (c[r.status] !== undefined) {
        c[r.status] += 1;
      }
    });

    return c;
  }, [reservations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations.filter((r) => {
      const matchesStatus =
        statusFilter === "all" ||
        r.status === statusFilter;

      const matchesSearch =
        !query ||
        String(r.guest?.name || "")
          .toLowerCase()
          .includes(query) ||
        String(
          r.referenceCode || r.id || ""
        )
          .toLowerCase()
          .includes(query) ||
        String(r.roomType || "")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [
    reservations,
    statusFilter,
    search,
  ]);

  const selected =
    reservations.find(
      (r) => r.id === selectedId
    ) || null;

  async function handleCheckIn(id) {
    /*
     * The current reservations schema does not contain
     * a dedicated checked_in status / checked_in_at field.
     *
     * Therefore we don't falsely write a status here.
     * The UI currently derives "checked-in" from dates.
     */
    const reservation = reservations.find(
      (r) => r.id === id
    );

    if (!reservation) return;

    alert(
      "The current database schema does not have a dedicated check-in field yet. The reservation is currently classified as checked-in based on its stay dates."
    );
  }

  async function handleCancel(id) {
    const confirmed = window.confirm(
      "Cancel this booking? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      await api(
        `/admin/reservations/${id}/cancel`,
        {
          method: "POST",
        }
      );

      await loadReservations();

      setSelectedId(null);
    } catch (err) {
      console.error(
        "Failed to cancel reservation:",
        err
      );

      alert(
        err.message ||
          "Failed to cancel reservation."
      );
    }
  }

  async function handleModify(id, draft) {
    try {
      const data = await api(`/admin/reservations/${id}`, {
        method: "PATCH",
        body: {
          checkIn: draft.checkIn,
          checkOut: draft.checkOut,
          specialRequests: draft.specialRequests,
        },
      });

      if (data.reservation) {
        const prev = reservations.find((r) => r.id === id);

        const updated = {
          ...prev,
          ...data.reservation,
          id: String(data.reservation.id || id),
          nights: nightsBetween(
            data.reservation.checkIn,
            data.reservation.checkOut
          ),
          activityLog: [
            {
              label: "Booking dates/requests modified by staff",
              time: new Date(),
            },
            ...(prev?.activityLog || []),
          ],
        };

        setReservations((list) =>
          list.map((r) => (r.id === id ? updated : r))
        );
      } else {
        await loadReservations();
      }
    } catch (err) {
      console.error("Failed to modify reservation:", err);
      throw err;
    }
  }

  function handleAddNote(id, noteText) {
    /*
     * Staff notes are intentionally not persisted yet.
     *
     * The current reservations schema has no staff_notes
     * or reservation_activity table.
     */
    setReservations((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              activityLog: [
                {
                  label: `Staff note: ${noteText}`,
                  time: new Date(),
                },
                ...(r.activityLog || []),
              ],
            }
          : r
      )
    );
  }

  return (
    <div className="res-page">
      <AdminSidebar activeKey="reservations" />

      <div className="res-list-panel">
        <div className="res-list-header">
          <div>
            <h1>Reservations</h1>

            <p>
              Manage and review check-ins,
              bookings, and guest requests
            </p>
          </div>

          <button
            type="button"
            className="res-search-toggle"
            onClick={() =>
              setSearchOpen((v) => !v)
            }
            aria-label="Search reservations"
          >
            &#128269;
          </button>
        </div>

        {searchOpen && (
          <input
            type="text"
            autoFocus
            className="res-search-input"
            placeholder="Search by guest name, reference no., or room..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        )}

        <div className="res-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                "res-tab" +
                (statusFilter === tab.key
                  ? " res-tab--active"
                  : "")
              }
              onClick={() =>
                setStatusFilter(tab.key)
              }
            >
              {tab.label}{" "}
              <span>
                {counts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              margin: "12px 0",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#FCE8E4",
              color: "#A83F2D",
            }}
          >
            {error}

            <button
              type="button"
              onClick={loadReservations}
              style={{
                marginLeft: "10px",
                border: 0,
                background: "transparent",
                color: "inherit",
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div className="res-table-scroll">
          <table className="res-table">
            <thead>
              <tr><th>Ref No.</th><th>Guest</th><th>Room Type</th><th>Check-in</th><th>Nights</th><th>Status</th></tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="res-empty"
                  >
                    Loading reservations...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.id === selectedId
                        ? "res-row--selected"
                        : ""
                    }
                    onClick={() =>
                      setSelectedId(r.id)
                    }
                  >
                    <td>
                      #
                      {r.referenceCode ||
                        r.id}
                    </td>

                    <td>
                      {r.guest?.name ||
                        "Guest"}
                    </td>

                    <td>
                      {r.roomType || "—"}
                    </td>

                    <td>{formatDate(r.checkIn)}</td>
                    <td>{nightsBetween(r.checkIn, r.checkOut)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="res-empty"
                  >
                    No reservations match this
                    filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
          <ReservationDrawer
            reservation={selected}
            onClose={() => setSelectedId(null)}
            onCheckIn={handleCheckIn}
            onCancelBooking={handleCancel}
            onModify={handleModify}
            onAddNote={handleAddNote}
          />
        )}
    </div>
  );
}