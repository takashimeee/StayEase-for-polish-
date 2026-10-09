import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import AvailabilityDatePicker from "../components/AvailabilityDatePicker";
import PageShell from "../components/PageShell";
import Modal from "../components/Modal";
import GuestStepper from "../components/GuestStepper";
import { Alert, Badge, Button, DetailRow, EmptyState, Page, PageHeader, Select, cx, inputCls } from "../components/ui";
import { useApp } from "../context/AppContext";
import {
  addDays,
  calcPricing,
  cancellationOutcome,
  downloadReceipt,
  formatDate,
  formatMoney,
  formatShortRange,
  getStatus,
  guestsLabel,
  nightsBetween,
  stayIssue,
  todayISO,
} from "../lib/utils";

const TABS = ["Upcoming", "Completed", "Cancelled"];
const RANGES = [
  { value: "any", label: "Anytime" },
  { value: "next30", label: "Next 30 days" },
  { value: "next90", label: "Next 90 days" },
  { value: "past30", label: "Past 30 days" },
  { value: "past90", label: "Past 90 days" },
];
const PAGE_SIZE = 3;

const STATUS_TONE = { upcoming: "mint", completed: "sand", cancelled: "danger" };

function inRange(r, range) {
  if (range === "any") return true;
  const t = todayISO();
  switch (range) {
    case "next30":
      return r.checkIn >= t && r.checkIn <= addDays(t, 30);
    case "next90":
      return r.checkIn >= t && r.checkIn <= addDays(t, 90);
    case "past30":
      return r.checkIn < t && r.checkIn >= addDays(t, -30);
    case "past90":
      return r.checkIn < t && r.checkIn >= addDays(t, -90);
    default:
      return true;
  }
}

export default function MyReservations() {
  const { myReservations } = useApp();
  const [tab, setTab] = useState("Upcoming");
  const [text, setText] = useState("");
  const [range, setRange] = useState("any");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // { type: 'view'|'modify'|'cancel', id }

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const filtered = myReservations.filter((r) => {
    const q = text.trim().toLowerCase();
    return (
      getStatus(r) === tab.toLowerCase() &&
      inRange(r, range) &&
      (!q || r.roomName.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = modal ? myReservations.find((r) => r.id === modal.id) : null;

  const counts = TABS.reduce((acc, t) => {
    acc[t] = myReservations.filter((r) => getStatus(r) === t.toLowerCase()).length;
    return acc;
  }, {});

  return (
    <PageShell>
      <Page>
        <PageHeader
          eyebrow="Your trips"
          title="My reservations"
          subtitle="Everything you've booked with us, in one place."
          action={
            <Button as={Link} to="/rooms" variant="outline">
              Plan another stay
            </Button>
          }
        />

        {notice && (
          <Alert tone="success" className="mb-6">
            {notice}
          </Alert>
        )}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-forest/10">
          <div className="-mb-px flex gap-6 overflow-x-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                }}
                className={cx(
                  "whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:text-coral",
                  tab === t ? "border-coral text-forest" : "border-transparent text-ink/50 hover:text-ink"
                )}
              >
                {t} <span className="text-xs font-normal text-ink/40">{counts[t]}</span>
              </button>
            ))}
          </div>

          <div className="mb-3 flex w-full flex-wrap gap-3 sm:w-auto">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                className={cx(inputCls.replace("h-12", "h-10"), "pl-10")}
                placeholder="Room or reference"
                aria-label="Search reservations"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  setPage(1);
                }}
                className="h-10"
                aria-label="Filter by date"
              >
                {RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {pageItems.length > 0 ? (
            pageItems.map((r) => (
              <ReservationCard
                key={r.id}
                r={r}
                onView={() => setModal({ type: "view", id: r.id })}
                onModify={() => setModal({ type: "modify", id: r.id })}
                onCancel={() => setModal({ type: "cancel", id: r.id })}
              />
            ))
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title={myReservations.length === 0 ? "No stays booked yet" : "Nothing matches your filters"}
              action={
                <Button as={Link} to="/rooms">
                  Find a room
                </Button>
              }
            >
              {myReservations.length === 0
                ? "When you book a room, it will appear here."
                : "Try a different tab, search or date range."}
            </EmptyState>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-1.5 pt-10 text-sm" aria-label="Pagination">
            <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft size={15} aria-hidden="true" /> Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? "page" : undefined}
                className={cx(
                  "h-9 w-9 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/20",
                  n === currentPage ? "bg-forest text-white" : "text-ink/70 hover:bg-forest/5"
                )}
              >
                {n}
              </button>
            ))}
            <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              Next <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </nav>
        )}
      </Page>

      {selected && modal.type === "view" && <ViewModal r={selected} onClose={() => setModal(null)} />}
      {selected && modal.type === "modify" && (
        <ModifyModal
          r={selected}
          onClose={() => setModal(null)}
          onDone={(msg) => {
            setNotice(msg);
            setModal(null);
          }}
        />
      )}
      {selected && modal.type === "cancel" && (
        <CancelModal
          r={selected}
          onClose={() => setModal(null)}
          onDone={(msg) => {
            setNotice(msg);
            setModal(null);
          }}
        />
      )}
    </PageShell>
  );
}

function Photo({ src, alt, className }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx("overflow-hidden bg-sand", className)}>
      {src && !failed && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />}
    </div>
  );
}

function arrivalText(r) {
  const days = nightsBetween(todayISO(), r.checkIn);
  if (days > 1) return `Arriving in ${days} days`;
  if (days === 1) return "Arriving tomorrow";
  if (days === 0) return "Arriving today";
  return "Currently staying";
}

function ReservationCard({ r, onView, onModify, onCancel }) {
  const status = getStatus(r);
  const upcoming = status === "upcoming";
  const total = status === "cancelled" ? r.refund : r.total;

  return (
    <article
      className={cx(
        "overflow-hidden rounded-2xl bg-white",
        upcoming ? "shadow-[0_15px_50px_rgba(38,67,52,0.09)]" : "border border-forest/[0.08]"
      )}
    >
      <div className="flex flex-col sm:flex-row">
        <Photo
          src={r.image}
          alt={r.roomName}
          className={cx("w-full shrink-0 sm:w-56", upcoming ? "h-52 sm:h-auto" : "h-40 sm:h-auto sm:w-44", !upcoming && "opacity-90")}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {upcoming && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">{arrivalText(r)}</p>}
              <h2 className={cx("font-serif tracking-[-0.02em] text-forest", upcoming ? "text-2xl" : "text-xl")}>{r.roomName}</h2>
              <p className="mt-1 text-xs text-ink/50">Ref {r.ref}</p>
            </div>
            <Badge tone={STATUS_TONE[status]}>{status}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Dates</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{formatShortRange(r.checkIn, r.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Stay</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {r.nights} night{r.nights !== 1 ? "s" : ""} · {guestsLabel(r.adults, r.children)}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">{status === "cancelled" ? "Refunded" : "Total paid"}</dt>
              <dd className="mt-1 font-serif text-lg font-semibold text-forest">₱{formatMoney(total)}</dd>
            </div>
          </dl>
          {r.breakfastItems?.length > 0 && (
            <p className="text-xs text-ink/60">
              Breakfast: {r.breakfastItems.map((item) => `${item.name} × ${item.quantity}`).join(", ")}
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant={upcoming ? "primary" : "outline"} onClick={onView}>
              View details
            </Button>
            {upcoming && (
              <>
                <Button size="sm" variant="outline" onClick={onModify}>
                  Modify
                </Button>
                <Button size="sm" variant="danger" onClick={onCancel}>
                  Cancel
                </Button>
              </>
            )}
            {status === "completed" && (
              <Button as={Link} to={`/rooms/${r.roomId}`} size="sm" variant="ghost">
                Book again
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ViewModal({ r, onClose }) {
  const status = getStatus(r);
  return (
    <Modal title="Reservation details" onClose={onClose}>
      <Photo src={r.image} alt={r.roomName} className="mb-4 aspect-[16/9] rounded-xl" />
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-serif text-lg text-forest">{r.roomName}</h3>
        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      </div>
      <dl>
        <DetailRow label="Reference" value={r.ref} />
        <DetailRow label="Check-in" value={`${formatDate(r.checkIn)} (from 3:00 PM)`} />
        <DetailRow label="Check-out" value={`${formatDate(r.checkOut)} (until 11:00 AM)`} />
        <DetailRow label="Nights" value={r.nights} />
        <DetailRow label="Guests" value={guestsLabel(r.adults, r.children)} />
        <DetailRow label="Primary guest" value={`${r.guest.fullName} · ${r.guest.email}`} />
        {r.guest.specialRequests && <DetailRow label="Special requests" value={r.guest.specialRequests} />}
        <DetailRow label="Room subtotal" value={`₱${formatMoney(r.subtotal)}`} />
        <DetailRow label="Resort fees & taxes" value={`₱${formatMoney(r.fees)}`} />
        <DetailRow label="Service fee" value={`₱${formatMoney(r.service)}`} />
        {r.breakfastItems?.map((item) => (
          <DetailRow
            key={item.itemId}
            label={`Breakfast: ${item.name} × ${item.quantity}`}
            value={`₱${formatMoney(item.lineTotal)}`}
          />
        ))}
        {r.breakfastSubtotal > 0 && (
          <DetailRow label="Breakfast subtotal" value={`₱${formatMoney(r.breakfastSubtotal)}`} />
        )}
        <DetailRow label="Total" value={`₱${formatMoney(r.total)}`} strong />
        <DetailRow label="Payment method" value={r.paymentMethod} />
        {status === "cancelled" && <DetailRow label="Refund" value={`₱${formatMoney(r.refund)}`} />}
      </dl>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {status !== "cancelled" && (
          <Button variant="outline" onClick={() => downloadReceipt(r)}>
            Download receipt
          </Button>
        )}
        {status === "completed" && (
          <Button as={Link} to={`/rooms/${r.roomId}`}>
            Book again
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function ModifyModal({ r, onClose, onDone }) {
  const { modifyReservation, isRoomAvailable, findRoom } = useApp();
  const room = findRoom(r.roomId);
  const [checkIn, setCheckIn] = useState(r.checkIn);
  const [checkOut, setCheckOut] = useState(r.checkOut);
  const [adults, setAdults] = useState(r.adults);
  const [children, setChildren] = useState(r.children);
  const [error, setError] = useState("");

  // The reservation being edited must not block its own dates.
  const availableExceptThis = (id, a, b) => isRoomAvailable(id, a, b, r.id);

  const nights = nightsBetween(checkIn, checkOut);
  const available = nights > 0 ? availableExceptThis(room.id, checkIn, checkOut) : true;
  const issue = stayIssue({ room, checkIn, checkOut, adults, children, available });
  const pricing = calcPricing(room, nights);
  const newTotal = pricing.total + Number(r.breakfastSubtotal || 0);
  const diff = newTotal - r.total;

  const save = async () => {
    const result = await modifyReservation(r.id, { checkIn, checkOut, adults, children });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(`Reservation ${r.ref} updated. New total: ₱${formatMoney(result.newTotal)}.`);
  };

  return (
    <Modal title={`Modify — ${r.roomName}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AvailabilityDatePicker
          label="Check-in"
          value={checkIn}
          onChange={(value) => {
            setCheckIn(value);
            if (checkOut <= value) setCheckOut(addDays(value, room.minNights));
            setError("");
          }}
          roomId={room.id}
          isRoomAvailable={availableExceptThis}
          mode="checkIn"
          min={todayISO()}
        />
        <AvailabilityDatePicker
          label="Check-out"
          value={checkOut}
          onChange={(value) => {
            setCheckOut(value);
            setError("");
          }}
          roomId={room.id}
          isRoomAvailable={availableExceptThis}
          mode="checkOut"
          rangeStart={checkIn}
          min={checkIn ? addDays(checkIn, room.minNights) : todayISO()}
        />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GuestStepper label="Adults" value={adults} min={1} max={Math.max(1, room.maxGuests - children)} onChange={setAdults} />
        <GuestStepper label="Children" value={children} min={0} max={Math.max(0, room.maxGuests - adults)} onChange={setChildren} />
      </div>

      {(issue || error) && (
        <Alert tone="error" className="mb-4">
          {error || issue}
        </Alert>
      )}

      <div className="mb-5 space-y-1.5 rounded-xl bg-mint p-4 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Current total</span>
          <span>₱{formatMoney(r.total)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>
            New total ({nights} night{nights !== 1 ? "s" : ""})
          </span>
          <span>₱{formatMoney(newTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-forest/15 pt-2 font-semibold text-forest">
          <span>{diff >= 0 ? "Additional amount due" : "Refund due"}</span>
          <span>₱{formatMoney(Math.abs(diff))}</span>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Keep as is
        </Button>
        <Button onClick={save} disabled={Boolean(issue)}>
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

function CancelModal({ r, onClose, onDone }) {
  const { cancelReservation } = useApp();
  const [error, setError] = useState("");
  const outcome = cancellationOutcome(r);

  const confirm = async () => {
    const res = await cancelReservation(r.id);
    if (!res.ok) {
      setError(res.error || "We couldn't cancel this reservation. Please try again.");
      return;
    }
    onDone(`Reservation ${r.ref} cancelled. Refund: ₱${formatMoney(res.refund)}.`);
  };

  return (
    <Modal title="Cancel this reservation?" onClose={onClose}>
      <p className="mb-1 text-sm text-ink/70">
        <strong className="text-ink">{r.roomName}</strong> · {formatShortRange(r.checkIn, r.checkOut)}
      </p>
      <p className="mb-4 text-sm text-ink/70">Reference {r.ref}</p>

      <Alert tone={outcome.free ? "success" : "error"} className="mb-5">
        {outcome.free ? (
          <>Free cancellation applies. You'll be refunded the full ₱{formatMoney(r.total)}.</>
        ) : (
          <>
            You're within 48 hours of check-in, so one night plus taxes (₱{formatMoney(outcome.charge)}) is charged. You'll be refunded ₱
            {formatMoney(outcome.refund)}.
          </>
        )}
      </Alert>

      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Keep reservation
        </Button>
        <Button variant="dangerSolid" onClick={confirm}>
          Yes, cancel it
        </Button>
      </div>
    </Modal>
  );
}