import { useEffect, useRef, useState } from "react";
import {
  X, Mail, Phone, Copy, Check, ArrowRight, Pencil, Ban, LogIn, Send, Moon, Users, Wallet,
} from "lucide-react";
import "./ReservationDrawer.css";

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const nightsBetween = (a, b) => (a && b ? Math.max(0, dayDiff(a, b)) : 0);

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(typeof value === "string" && value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const peso = (v) =>
  `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function phaseText(r) {
  const today = todayISO();
  if (r.status === "cancelled") return "This booking was cancelled";
  if (r.status === "completed") return `Checked out ${formatDate(r.checkOut)}`;
  if (r.status === "checked-in") {
    const left = dayDiff(today, r.checkOut);
    return left <= 0 ? "Checking out today" : `In-house · ${left} night${left === 1 ? "" : "s"} left`;
  }
  const d = dayDiff(today, r.checkIn);
  if (d <= 0) return "Arriving today";
  if (d === 1) return "Arrives tomorrow";
  return `Arrives in ${d} days`;
}

const STATUS_LABELS = {
  upcoming: "Upcoming",
  "checked-in": "Checked-in",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }) {
  return <span className={`rd-pill rd-pill--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

const blank = (r) => ({
  checkIn: r.checkIn || "",
  checkOut: r.checkOut || "",
  specialRequests: r.specialRequests || "",
});

/* ---------- component ---------- */
export default function ReservationDrawer({
  reservation: r,
  onClose,
  onCheckIn,
  onCancelBooking,
  onModify,
  onAddNote,
}) {
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(blank(r));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const scrollRef = useRef(null);

  // Reset when a different reservation is opened.
  useEffect(() => {
    setTab("overview");
    setEditing(false);
    setDraft(blank(r));
    setFormError("");
    setNote("");
    setSaving(false);
  }, [r.id]);

  // Jump back to the top when switching tabs.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab, r.id]);

  // Esc: cancel editing first, then close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (editing) setEditing(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked, ignore */
    }
  }

  const canAct = r.status !== "cancelled" && r.status !== "completed";
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const draftNights = nightsBetween(draft.checkIn, draft.checkOut);
  const dirty =
    draft.checkIn !== r.checkIn ||
    draft.checkOut !== r.checkOut ||
    draft.specialRequests !== (r.specialRequests || "");
  const guests = (r.occupancy?.adults || 0) + (r.occupancy?.children || 0);
  const ref = r.referenceCode || r.id;

  const pay = r.payment || {};
  const payRaw = String(pay.status || "Pending");
  const payKey = payRaw.toLowerCase().replace(/[\s_]+/g, "-");
  const payLabel = payRaw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const txn = pay.transactionId && !/—$/.test(pay.transactionId) ? pay.transactionId : "—";
  const price = r.pricing;
  const log = r.activityLog || [];

  function startEdit() {
    setDraft(blank(r));
    setFormError("");
    setTab("overview");
    setEditing(true);
  }

  async function save() {
    if (!draft.checkIn || !draft.checkOut) return setFormError("Select both dates.");
    if (draft.checkOut <= draft.checkIn) return setFormError("Check-out must be after check-in.");
    setFormError("");
    setSaving(true);
    try {
      await onModify(r.id, draft);
      setEditing(false);
    } catch (err) {
      setFormError(err?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  function submitNote() {
    if (!note.trim()) return;
    onAddNote(r.id, note.trim());
    setNote("");
  }

  const tabs = [
    ["overview", "Overview"],
    ["payment", "Payment"],
    ["activity", `Activity${log.length ? ` (${log.length})` : ""}`],
  ];

  return (
    <>
      <div className="rd-backdrop" onClick={onClose} />
      <aside className="rd" role="dialog" aria-label={`Reservation ${ref}`}>
        {/* Pinned header */}
        <header className="rd__head">
          <div className="rd__head-top">
            <button type="button" className="rd__ref" onClick={() => copy(String(ref), "ref")} title="Copy reference">
              #{ref}
              {copied === "ref" ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <button type="button" className="rd__close" onClick={onClose} aria-label="Close details">
              <X size={18} />
            </button>
          </div>

          <div className="rd__title-row">
            <h2>{r.guest?.name || "Guest"}</h2>
            <StatusBadge status={r.status} />
          </div>
          <p className="rd__phase">{phaseText(r)}</p>

          <div className="rd__tabs" role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`rd__tab ${tab === key ? "is-active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Scrolling body */}
        <div className="rd__scroll" ref={scrollRef}>
          <div className="rd__body" key={`${r.id}-${tab}`}>
            {tab === "overview" && (
              <>
                <div className="rd-tiles">
                  <div className="rd-tile">
                    <Moon size={15} />
                    <strong>{editing ? draftNights : nights}</strong>
                    <span>{(editing ? draftNights : nights) === 1 ? "Night" : "Nights"}</span>
                  </div>
                  <div className="rd-tile">
                    <Users size={15} />
                    <strong>{guests}</strong>
                    <span>{guests === 1 ? "Guest" : "Guests"}</span>
                  </div>
                  <div className="rd-tile">
                    <Wallet size={15} />
                    <strong>{peso(pay.total).replace(".00", "")}</strong>
                    <span>Total</span>
                  </div>
                </div>

                <section className="rd-card">
                  <h3>Stay</h3>
                  <div className="rd-room">
                    <div className="rd-room__thumb">{(r.roomType || "R")[0]}</div>
                    <div>
                      <div className="rd-room__name">{r.roomType || "Room"}</div>
                      <div className="rd-room__sub">
                        {r.roomNumber && r.roomNumber !== r.roomType ? `Room ${r.roomNumber}` : r.roomName || "Room assignment"}
                      </div>
                    </div>
                  </div>

                  {editing ? (
                    <div className="rd-edit">
                      <label>
                        Check-in
                        <input
                          type="date"
                          value={draft.checkIn}
                          max={draft.checkOut || undefined}
                          onChange={(e) => setDraft((d) => ({ ...d, checkIn: e.target.value }))}
                        />
                      </label>
                      <label>
                        Check-out
                        <input
                          type="date"
                          value={draft.checkOut}
                          min={draft.checkIn || undefined}
                          onChange={(e) => setDraft((d) => ({ ...d, checkOut: e.target.value }))}
                        />
                      </label>
                      {draftNights !== nights && draftNights > 0 && (
                        <p className="rd-edit__delta">
                          {nights} → {draftNights} nights. The total will be recalculated on save.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rd-dates">
                      <div>
                        <small>Check-in</small>
                        <strong>{formatDate(r.checkIn)}</strong>
                        <span>2:00 PM</span>
                      </div>
                      <div className="rd-dates__mid">
                        <ArrowRight size={16} />
                        <em>{nights} night{nights === 1 ? "" : "s"}</em>
                      </div>
                      <div>
                        <small>Check-out</small>
                        <strong>{formatDate(r.checkOut)}</strong>
                        <span>12:00 PM</span>
                      </div>
                    </div>
                  )}

                  <div className="rd-field">
                    <small>Special requests</small>
                    {editing ? (
                      <textarea
                        rows={3}
                        value={draft.specialRequests}
                        placeholder="No special requests"
                        onChange={(e) => setDraft((d) => ({ ...d, specialRequests: e.target.value }))}
                      />
                    ) : (
                      <p className={r.specialRequests ? "" : "is-muted"}>{r.specialRequests || "None provided."}</p>
                    )}
                  </div>
                </section>

                {r.breakfastItems?.length > 0 && (
                  <section className="rd-card">
                    <h3>Breakfast order</h3>
                    <div className="rd-rows rd-rows--lines">
                      {r.breakfastItems.map((item) => (
                        <div className="rd-row" key={item.itemId}>
                          <span>{item.name} × {item.quantity}</span>
                          <span className="rd-row__val">{peso(item.lineTotal)}</span>
                        </div>
                      ))}
                      <div className="rd-row rd-row--total">
                        <span>Breakfast total</span>
                        <span>{peso(price?.breakfast)}</span>
                      </div>
                    </div>
                  </section>
                )}

                <section className="rd-card">
                  <h3>Guest</h3>
                  <div className="rd-rows">
                    <div className="rd-row">
                      <span>Email</span>
                      <span className="rd-row__val">
                        {r.guest?.email || "—"}
                        {r.guest?.email && (
                          <button type="button" className="rd-mini" onClick={() => copy(r.guest.email, "email")} aria-label="Copy email">
                            {copied === "email" ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="rd-row">
                      <span>Phone</span>
                      <span className="rd-row__val">{r.guest?.phone || "—"}</span>
                    </div>
                    <div className="rd-row">
                      <span>Occupancy</span>
                      <span className="rd-row__val">
                        {r.occupancy?.adults || 0} adult{(r.occupancy?.adults || 0) === 1 ? "" : "s"}, {r.occupancy?.children || 0} child
                        {(r.occupancy?.children || 0) === 1 ? "" : "ren"}
                      </span>
                    </div>
                  </div>
                  <div className="rd-contact">
                    <a className={`rd-btn rd-btn--ghost ${r.guest?.email ? "" : "is-disabled"}`} href={r.guest?.email ? `mailto:${r.guest.email}` : undefined}>
                      <Mail size={14} /> Email
                    </a>
                    <a className={`rd-btn rd-btn--ghost ${r.guest?.phone ? "" : "is-disabled"}`} href={r.guest?.phone ? `tel:${r.guest.phone}` : undefined}>
                      <Phone size={14} /> Call
                    </a>
                  </div>
                </section>
              </>
            )}

            {tab === "payment" && (
              <section className="rd-card">
                <div className="rd-pay-head">
                  <div>
                    <small>Total</small>
                    <strong>{peso(pay.total)}</strong>
                  </div>
                  <span className={`rd-pill rd-pill--pay-${payKey}`}>{payLabel}</span>
                </div>

                {price && (
                  <div className="rd-rows rd-rows--lines">
                    <div className="rd-row"><span>Room ({nights} night{nights === 1 ? "" : "s"})</span><span>{peso(price.roomSubtotal)}</span></div>
                    {price.breakfast > 0 && <div className="rd-row"><span>Breakfast</span><span>{peso(price.breakfast)}</span></div>}
                    {r.breakfastItems?.map((item) => (
                      <div className="rd-row" key={item.itemId}>
                        <span>{item.name} × {item.quantity}</span>
                        <span>{peso(item.lineTotal)}</span>
                      </div>
                    ))}
                    <div className="rd-row"><span>Fees</span><span>{peso(price.fees)}</span></div>
                    <div className="rd-row"><span>Service</span><span>{peso(price.service)}</span></div>
                    <div className="rd-row rd-row--total"><span>Total</span><span>{peso(pay.total)}</span></div>
                  </div>
                )}

                <div className="rd-rows">
                  <div className="rd-row"><span>Method</span><span>{pay.method || "—"}</span></div>
                  <div className="rd-row">
                    <span>Transaction ID</span>
                    <span className="rd-row__val">
                      {txn}
                      {txn !== "—" && (
                        <button type="button" className="rd-mini" onClick={() => copy(txn, "txn")} aria-label="Copy transaction ID">
                          {copied === "txn" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      )}
                    </span>
                  </div>
                  {r.refund > 0 && <div className="rd-row"><span>Refunded</span><span>{peso(r.refund)}</span></div>}
                </div>
              </section>
            )}

            {tab === "activity" && (
              <section className="rd-card rd-card--flush">
                {log.length === 0 ? (
                  <p className="is-muted">No activity yet.</p>
                ) : (
                  <ol className="rd-timeline">
                    {log.map((entry, i) => (
                      <li key={`${entry.label}-${i}`}>
                        <span className="rd-timeline__dot" />
                        <div>
                          <div>{entry.label}</div>
                          <small>{formatDateTime(entry.time)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>

        {/* Pinned footer */}
        {tab === "activity" ? (
          <footer className="rd__foot rd__foot--note">
            <input
              type="text"
              placeholder="Add a staff note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNote()}
            />
            <button type="button" className="rd-btn rd-btn--primary" onClick={submitNote} disabled={!note.trim()}>
              <Send size={14} /> Add
            </button>
          </footer>
        ) : editing ? (
          <footer className="rd__foot">
            {formError && <p className="rd__error" role="alert">{formError}</p>}
            <div className="rd__foot-row">
              <button type="button" className="rd-btn rd-btn--ghost" disabled={saving} onClick={() => setEditing(false)}>
                Discard
              </button>
              <button type="button" className="rd-btn rd-btn--primary" disabled={saving || !dirty} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </footer>
        ) : (
          canAct && (
            <footer className="rd__foot">
              <div className="rd__foot-row">
                {r.status === "upcoming" && (
                  <button type="button" className="rd-btn rd-btn--primary" onClick={() => onCheckIn(r.id)}>
                    <LogIn size={14} /> Check in
                  </button>
                )}
                <button type="button" className="rd-btn rd-btn--ghost" onClick={startEdit}>
                  <Pencil size={14} /> Modify
                </button>
                <button type="button" className="rd-btn rd-btn--danger" onClick={() => onCancelBooking(r.id)}>
                  <Ban size={14} /> Cancel
                </button>
              </div>
            </footer>
          )
        )}
      </aside>
    </>
  );
}