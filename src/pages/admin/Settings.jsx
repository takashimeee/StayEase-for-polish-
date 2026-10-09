import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import AdminSidebar from "../../components/AdminSidebar";
import { api } from "../../lib/api";
import "./Settings.css";

// Maps AdminSidebar's nav keys to routes. Keep in sync with AppRoutes.jsx.
const NAV_ROUTES = {
  dashboard: "/admin/dashboard",
  reservations: "/admin/reservations",
  rooms: "/admin/rooms",
  housekeeping: "/admin/housekeeping",
  analytics: "/admin/analytics",
  settings: "/admin/settings",
};

// Compare as strings so "12" (typed) and 12 (from the server) count as the same.
const normalize = (obj) =>
  JSON.stringify(
    Object.keys(obj)
      .sort()
      .map((k) => [k, String(obj[k])])
  );

function Section({ title, subtitle, children }) {
  return (
    <section className="st-card">
      <div className="st-card__head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="st-card__body">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="st-field">
      <span className="st-field__label">{label}</span>
      {children}
      {hint && <span className="st-field__hint">{hint}</span>}
    </label>
  );
}

const EMPTY_STAFF = { fullName: "", email: "", password: "" };

export default function Settings() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [newStaff, setNewStaff] = useState(EMPTY_STAFF);
  const [staffError, setStaffError] = useState("");
  const [addingStaff, setAddingStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/admin/settings"), api("/admin/housekeepers")])
      .then(([settings, housekeepers]) => {
        if (cancelled) return;
        setSaved(settings);
        setForm(settings);
        setStaff(housekeepers);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => (form && saved ? normalize(form) !== normalize(saved) : false), [form, saved]);

  function set(key, value) {
    setSaveOk(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    try {
      const updated = await api("/admin/settings", { method: "PUT", body: form });
      setSaved(updated);
      setForm(updated);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setForm(saved);
    setSaveError("");
    setSaveOk(false);
  }

  async function addStaff(e) {
    e.preventDefault();
    setStaffError("");
    setAddingStaff(true);
    try {
      const created = await api("/admin/housekeepers", { method: "POST", body: newStaff });
      setStaff((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStaff(EMPTY_STAFF);
    } catch (err) {
      setStaffError(err.message);
    } finally {
      setAddingStaff(false);
    }
  }

  async function removeStaff(member) {
    if (!window.confirm(`Deactivate ${member.name}? Their current room assignments will be cleared.`)) return;
    setStaffError("");
    try {
      await api(`/admin/housekeepers/${member.id}`, { method: "DELETE" });
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err) {
      setStaffError(err.message);
    }
  }

  return (
    <div className="st-layout">
      <AdminSidebar
        activeKey="settings"
        onNavigate={(key) => navigate(NAV_ROUTES[key] ?? "/admin/settings")}
      />

      <main className="st-page">
        <header className="st-header">
          <h1>Settings</h1>
          <p>Hotel details, stay rules and housekeeping staff for StayEase</p>
        </header>

        {loadError && <p className="st-error">{loadError}</p>}
        {!form && !loadError && <p>Loading settings...</p>}

        {form && (
          <form onSubmit={handleSave}>
            <Section title="Hotel Profile" subtitle="Contact details and daily check-in / check-out times">
              <div className="st-grid">
                <Field label="Hotel name">
                  <input type="text" value={form.hotelName} onChange={(e) => set("hotelName", e.target.value)} />
                </Field>
                <Field label="Contact email">
                  <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
                </Field>
                <Field label="Contact phone">
                  <input type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
                </Field>
                <Field label="Address">
                  <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="Check-in time">
                  <input type="time" value={form.checkInTime} onChange={(e) => set("checkInTime", e.target.value)} />
                </Field>
                <Field label="Check-out time">
                  <input type="time" value={form.checkOutTime} onChange={(e) => set("checkOutTime", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section
              title="Cancellation & Pricing"
              subtitle="Saved to the database. Guest booking still uses the rates and 48-hour rule set in server/index.js until you connect them."
            >
              <div className="st-grid">
                <Field label="Free cancellation window (hours)" hint="Before check-in">
                  <input type="number" min="0" max="720" value={form.cancellationHours} onChange={(e) => set("cancellationHours", e.target.value)} />
                </Field>
                <Field label="Fees rate (%)" hint="Matches FEE_RATE in .env">
                  <input type="number" min="0" max="100" step="0.01" value={form.feeRate} onChange={(e) => set("feeRate", e.target.value)} />
                </Field>
                <Field label="Service rate (%)" hint="Matches SERVICE_RATE in .env">
                  <input type="number" min="0" max="100" step="0.01" value={form.serviceRate} onChange={(e) => set("serviceRate", e.target.value)} />
                </Field>
              </div>
            </Section>

            <div className="st-savebar">
              <span className={saveError ? "st-error" : "st-ok"}>
                {saveError || (saveOk ? "Settings saved." : dirty ? "You have unsaved changes." : "")}
              </span>
              <div className="st-savebar__actions">
                <button type="button" className="st-btn st-btn--ghost" onClick={handleDiscard} disabled={!dirty || saving}>
                  Discard
                </button>
                <button type="submit" className="st-btn st-btn--primary" disabled={!dirty || saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        )}

        {form && (
          <Section
            title="Housekeeping Staff"
            subtitle="Accounts with the housekeeping role. Anyone listed here can be assigned on the room status board. Changes apply immediately."
          >
            <ul className="st-staff">
              {staff.map((member) => (
                <li key={member.id} title={member.email}>
                  <span>{member.name}</span>
                  <button type="button" onClick={() => removeStaff(member)} aria-label={`Deactivate ${member.name}`}>
                    <X size={14} />
                  </button>
                </li>
              ))}
              {staff.length === 0 && <li className="st-staff__empty">No housekeeping staff yet</li>}
            </ul>
            <form className="st-staff__add" onSubmit={addStaff}>
              <input
                type="text"
                placeholder="Full name"
                value={newStaff.fullName}
                onChange={(e) => setNewStaff((p) => ({ ...p, fullName: e.target.value }))}
              />
              <input
                type="email"
                placeholder="Email"
                value={newStaff.email}
                onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                type="password"
                placeholder="Temporary password (8+ characters)"
                value={newStaff.password}
                onChange={(e) => setNewStaff((p) => ({ ...p, password: e.target.value }))}
              />
              <button type="submit" className="st-btn st-btn--primary" disabled={addingStaff}>
                <Plus size={14} /> {addingStaff ? "Adding..." : "Add"}
              </button>
            </form>
            {staffError && <p className="st-error">{staffError}</p>}
          </Section>
        )}
      </main>
    </div>
  );
}