import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import { api } from "../../lib/api";
import "./RoomManagement.css";
import "./RoomUnits.css";

// Maps AdminSidebar's nav keys to routes. Keep this in sync with AppRoutes.jsx.
const NAV_ROUTES = {
  dashboard: "/admin/dashboard",
  reservations: "/admin/reservations",
  rooms: "/admin/rooms",
  housekeeping: "/admin/housekeeping",
  analytics: "/admin/analytics",
  settings: "/admin/settings",
};

const EMPTY_FORM = {
  name: "",
  type: "",
  price: "",
  minStay: "",
  capacity: "",
  size: "",
  quantity: "1",
  firstRoomNumber: "",
  amenities: [],
  description: "",
  popular: true,
  active: true,
  images: [],
};

function formatPrice(value) {
  return `\u20B1${Number(value).toLocaleString("en-PH")}`;
}

function AddRoomPanel({ onClose, onSave, types, amenityOptions }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, type: types[0] || "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleAmenity(amenity) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList).slice(0, 5 - form.images.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({ ...prev, images: [...prev.images, reader.result] }));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index) {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) return setError("Room name is required.");
    if (!form.type.trim()) return setError("Room type is required.");
    if (!form.price || Number(form.price) <= 0) return setError("Enter a valid price per night.");
    if (!form.minStay || Number(form.minStay) <= 0) return setError("Enter a valid minimum stay.");
    if (!form.capacity || Number(form.capacity) <= 0) return setError("Enter a valid max capacity.");
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return setError("Number of rooms must be between 1 and 50.");
    if (!/^\d{1,6}$/.test(form.firstRoomNumber.trim())) return setError("Enter the first room number, like 501.");

    setError("");
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        type: form.type,
        price: Number(form.price),
        minStay: Number(form.minStay),
        capacity: Number(form.capacity),
        size: form.size ? Number(form.size) : null,
        quantity: qty,
        firstRoomNumber: form.firstRoomNumber.trim(),
        amenityIds: form.amenities,
        description: form.description.trim(),
        popular: form.popular,
        active: form.active,
        images: form.images,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="room-panel__backdrop" onClick={onClose}>
      <form
        className="room-panel"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="room-panel__header">
          <h2>Add New Room</h2>
          <button type="button" className="room-panel__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="room-panel__body">
          <label
            className="room-panel__dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="room-panel__dropzone-icon">&#128247;</div>
            <div>Drag &amp; drop images or click to upload</div>
            <small>Max 5 images, JPG/PNG</small>
          </label>

          {form.images.length > 0 && (
            <div className="room-panel__previews">
              {form.images.map((src, i) => (
                <div className="room-panel__preview" key={i}>
                  <img src={src} alt={`Upload ${i + 1}`} />
                  <button type="button" onClick={() => removeImage(i)} aria-label="Remove image">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="room-panel__field">
            Room Name
            <input
              type="text"
              placeholder="e.g. Presidential Suite"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </label>

          <label className="room-panel__field">
            Room Type
            <input
              type="text"
              list="room-type-options"
              placeholder="e.g. Garden, Sea View, Loft"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
            />
            <datalist id="room-type-options">
              {types.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <div className="room-panel__row">
            <label className="room-panel__field">
              Price per Night
              <input
                type="number"
                min="0"
                placeholder="25000"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
              />
            </label>
            <label className="room-panel__field">
              Min Stay
              <input
                type="number"
                min="1"
                placeholder="nights"
                value={form.minStay}
                onChange={(e) => updateField("minStay", e.target.value)}
              />
            </label>
          </div>

          <div className="room-panel__row">
            <label className="room-panel__field">
              Max Capacity
              <input
                type="number"
                min="1"
                placeholder="guests"
                value={form.capacity}
                onChange={(e) => updateField("capacity", e.target.value)}
              />
            </label>
            <label className="room-panel__field">
              Room Size
              <input
                type="number"
                min="0"
                placeholder="sqm"
                value={form.size}
                onChange={(e) => updateField("size", e.target.value)}
              />
            </label>
          </div>

          <div className="room-panel__row">
            <label className="room-panel__field">
              Number of Rooms
              <input
                type="number"
                min="1"
                max="50"
                placeholder="e.g. 4"
                value={form.quantity}
                onChange={(e) => updateField("quantity", e.target.value)}
              />
            </label>
            <label className="room-panel__field">
              First Room Number
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 501"
                value={form.firstRoomNumber}
                onChange={(e) => updateField("firstRoomNumber", e.target.value)}
              />
            </label>
          </div>
          <small className="units-hint">
            {Number(form.quantity) > 1 && /^\d{1,6}$/.test(form.firstRoomNumber.trim())
              ? `Creates rooms ${form.firstRoomNumber.trim()} to ${
                  Number(form.firstRoomNumber.trim()) + Number(form.quantity) - 1
                }. `
              : ""}
            Each guest booking gets one of these rooms, and the type shows as booked only when all of them are taken.
          </small>

          <div className="room-panel__field">
            Amenities
            <div className="room-panel__chips">
              {amenityOptions.map((amenity) => (
                <button
                  type="button"
                  key={amenity.id}
                  className={
                    "room-panel__chip" +
                    (form.amenities.includes(amenity.id) ? " room-panel__chip--active" : "")
                  }
                  onClick={() => toggleAmenity(amenity.id)}
                >
                  {amenity.name}
                </button>
              ))}
              {amenityOptions.length === 0 && <small>No amenities set up yet.</small>}
            </div>
          </div>

          <label className="room-panel__field">
            Description
            <textarea
              rows={3}
              placeholder="Spacious suite featuring panoramic ocean views..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </label>

          <div className="room-panel__toggle-row">
            <span>Mark as Popular</span>
            <input
              type="checkbox"
              className="room-panel__switch"
              checked={form.popular}
              onChange={(e) => updateField("popular", e.target.checked)}
            />
          </div>

          <div className="room-panel__toggle-row">
            <span>Active Status</span>
            <input
              type="checkbox"
              className="room-panel__switch"
              checked={form.active}
              onChange={(e) => updateField("active", e.target.checked)}
            />
          </div>

          {error && <div className="room-panel__error">{error}</div>}
        </div>

        <div className="room-panel__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save Room"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UnitRow({ unit, busy, onFloor, onToggle }) {
  return (
    <li className={"units-row" + (unit.active ? "" : " units-row--off")}>
      <span className="units-row__number">{unit.roomNumber}</span>
      <label className="units-row__floor">
        Floor
        <input
          type="number"
          min="1"
          max="99"
          defaultValue={unit.floor}
          disabled={busy}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (Number.isInteger(next) && next >= 1 && next <= 99 && next !== unit.floor) onFloor(unit, next);
            else e.target.value = unit.floor;
          }}
        />
      </label>
      <button type="button" className="units-row__toggle" disabled={busy} onClick={() => onToggle(unit)}>
        {unit.active ? "Take out of service" : "Put back in service"}
      </button>
    </li>
  );
}

function ManageRoomsPanel({ room, onClose, onUpdated }) {
  const [quantity, setQuantity] = useState("1");
  const [firstNumber, setFirstNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(path, options, onDone) {
    setError("");
    setBusy(true);
    try {
      onUpdated(await api(path, options));
      if (onDone) onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return setError("Number of rooms must be between 1 and 50.");
    if (!/^\d{1,6}$/.test(firstNumber.trim())) return setError("Enter the first room number, like 505.");
    call(
      `/admin/rooms/${room.id}/units`,
      { method: "POST", body: { quantity: qty, firstRoomNumber: firstNumber.trim() } },
      () => {
        setQuantity("1");
        setFirstNumber("");
      }
    );
  }

  return (
    <div className="room-panel__backdrop" onClick={onClose}>
      <div className="room-panel" onClick={(e) => e.stopPropagation()}>
        <div className="room-panel__header">
          <h2>{room.name}: Rooms</h2>
          <button type="button" className="room-panel__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="room-panel__body">
          <p className="units-hint">
            {room.unitCount} room{room.unitCount === 1 ? "" : "s"} in service. Guests book this room type, and each
            booking is given one of the rooms below.
          </p>

          <ul className="units-list">
            {room.units.map((u) => (
              <UnitRow
                key={`${u.id}-${u.floor}-${u.active}`}
                unit={u}
                busy={busy}
                onFloor={(unit, floor) =>
                  call(`/admin/units/${unit.id}`, { method: "PATCH", body: { floor } })
                }
                onToggle={(unit) =>
                  call(`/admin/units/${unit.id}`, { method: "PATCH", body: { active: !unit.active } })
                }
              />
            ))}
            {room.units.length === 0 && <li className="units-row units-row--off">No rooms yet.</li>}
          </ul>

          <form className="units-add" onSubmit={handleAdd}>
            <h3>Add more rooms</h3>
            <div className="room-panel__row">
              <label className="room-panel__field">
                Number of Rooms
                <input type="number" min="1" max="50" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <label className="room-panel__field">
                First Room Number
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 505"
                  value={firstNumber}
                  onChange={(e) => setFirstNumber(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Saving..." : "Add rooms"}
            </button>
          </form>

          {error && <div className="room-panel__error">{error}</div>}
        </div>

        <div className="room-panel__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [options, setOptions] = useState({ types: [], amenities: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [panelOpen, setPanelOpen] = useState(false);
  const [managingId, setManagingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/admin/rooms"), api("/admin/room-options")])
      .then(([roomList, opts]) => {
        if (cancelled) return;
        setRooms(roomList);
        setOptions(opts);
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "All Types" || room.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [rooms, search, typeFilter]);

  // Throws on failure so the panel can show the error and stay open.
  async function handleSaveRoom(payload) {
    const created = await api("/admin/rooms", { method: "POST", body: payload });
    setRooms((prev) => [created, ...prev]);
    setOptions((prev) => (prev.types.includes(created.type) ? prev : { ...prev, types: [...prev.types, created.type] }));
    setPanelOpen(false);
  }

  function handleRoomUpdated(updated) {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const managingRoom = rooms.find((r) => r.id === managingId) || null;

  return (
    <div className="room-mgmt">
      <AdminSidebar
        activeKey="rooms"
        onNavigate={(key) => navigate(NAV_ROUTES[key] ?? "/admin/rooms")}
      />

      <main className="room-mgmt__content">
        <div className="room-mgmt__header">
          <h1>Room Management</h1>
          <button type="button" className="btn btn--primary" onClick={() => setPanelOpen(true)}>
            + Add New Room
          </button>
        </div>

        <div className="room-mgmt__toolbar">
          <div className="room-mgmt__search">
            <span>&#128269;</span>
            <input
              type="text"
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option>All Types</option>
            {options.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="room-mgmt__panel">
          <h2>Room Inventory</h2>

          <div className="room-mgmt__table-scroll">
          <table className="room-mgmt__table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Room Name</th>
                <th>Type</th>
                <th>Rooms</th>
                <th>Price/Night</th>
                <th>Min Stay</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id}>
                  <td>
                    <div className="room-mgmt__thumb">
                      {room.images[0] ? (
                        <img src={room.images[0]} alt={room.name} />
                      ) : (
                        <span>{room.name[0]}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {room.name}
                    {room.popular && <span className="room-mgmt__badge">Popular</span>}
                  </td>
                  <td>
                    <span className={`room-mgmt__type room-mgmt__type--${room.type.toLowerCase().replace(/\s+/g, "-")}`}>
                      {room.type}
                    </span>
                  </td>
                  <td>
                    <span className="units-count">
                      {room.unitCount}
                      {room.unitCount === 0 && <small> hidden from guests</small>}
                    </span>
                    <button type="button" className="units-manage" onClick={() => setManagingId(room.id)}>
                      Manage
                    </button>
                  </td>
                  <td>{formatPrice(room.price)}</td>
                  <td>{room.minStay} night{room.minStay > 1 ? "s" : ""}</td>
                  <td>{room.capacity} guests</td>
                  <td>
                    <span className={room.active ? "room-mgmt__status room-mgmt__status--active" : "room-mgmt__status"}>
                      {room.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={8} className="room-mgmt__empty">
                    Loading rooms...
                  </td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td colSpan={8} className="room-mgmt__empty">
                    {loadError}
                  </td>
                </tr>
              )}
              {!loading && !loadError && filteredRooms.length === 0 && (
                <tr>
                  <td colSpan={8} className="room-mgmt__empty">
                    No rooms match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          <div className="room-mgmt__footer">
            Showing {filteredRooms.length} of {rooms.length} room types ({rooms.reduce((n, r) => n + r.unitCount, 0)} rooms in total)
          </div>
        </div>
      </main>

      {panelOpen && (
        <AddRoomPanel
          onClose={() => setPanelOpen(false)}
          onSave={handleSaveRoom}
          types={options.types}
          amenityOptions={options.amenities}
        />
      )}

      {managingRoom && (
        <ManageRoomsPanel
          room={managingRoom}
          onClose={() => setManagingId(null)}
          onUpdated={handleRoomUpdated}
        />
      )}
    </div>
  );
}