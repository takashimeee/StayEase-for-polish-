import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Star,
} from "lucide-react";
import AvailabilityDatePicker from "../components/AvailabilityDatePicker";
import PageShell from "../components/PageShell";
import Stepper from "../components/Stepper";
import GuestStepper from "../components/GuestStepper";
import PriceSummary from "../components/PriceSummary";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  DetailRow,
  Field,
  Page,
  PageHeader,
  cx,
  inputCls,
  inputErrCls,
  textareaCls,
} from "../components/ui";
import { useApp } from "../context/AppContext";
import {
  EMAIL_PATTERN,
  addDays,
  calcPricing,
  formatDate,
  formatMoney,
  guestsLabel,
  nightsBetween,
  stayIssue,
  todayISO,
} from "../lib/utils";

const CANCELLATION_SUMMARY =
  "Free cancellation until 48 hours before check-in. Cancellations made after that window are subject to a one-night fee.";
const CANCELLATION_DETAILS =
  "If you cancel at least 48 hours before your check-in time, you'll receive a full refund. Cancellations within 48 hours of check-in are charged one night's stay plus applicable fees. No-shows are charged the full reservation amount. To cancel or make changes, visit My Reservations or contact our team.";

const LONG_DATE = {
  weekday: "short",
  month: "long",
  day: "numeric",
  year: "numeric",
};

export default function BookingReview() {
  const { draft, findRoom } = useApp();
  const room = findRoom(draft?.roomId);
  if (!draft || !room) return <Navigate to="/rooms" replace />;
  return <ReviewInner draft={draft} room={room} />;
}

function ReviewInner({ draft, room }) {
  const { setDraft, isRoomAvailable } = useApp();
  const navigate = useNavigate();

  const [editingStay, setEditingStay] = useState(false);
  const [editingGuest, setEditingGuest] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [guestErrors, setGuestErrors] = useState({});

  const set = (key, value) =>
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "checkIn" && next.checkOut <= value) {
        next.checkOut = addDays(value, room.minNights);
      }
      return next;
    });

  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const available =
    nights > 0 ? isRoomAvailable(room.id, draft.checkIn, draft.checkOut) : true;
  const issue = stayIssue({ room, ...draft, available });
  const pricing = calcPricing(room, nights);
  const breakfastItems = (draft.breakfastItems || []).filter((item) => item.quantity > 0);

  const saveGuest = () => {
    const found = {};
    if (!draft.fullName.trim()) found.fullName = "Enter the guest's full name.";
    if (!EMAIL_PATTERN.test(draft.email)) found.email = "Enter a valid email address.";
    if (draft.phone.trim().replace(/\D/g, "").length < 7) {
      found.phone = "Enter a valid phone number.";
    }
    setGuestErrors(found);
    if (Object.keys(found).length) return;
    setEditingGuest(false);
  };

  const editBtn = (editing, onClick, closeLabel = "Close") => (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Pencil size={13} aria-hidden="true" /> {editing ? closeLabel : "Edit"}
    </Button>
  );

  return (
    <PageShell stepper={<Stepper current={1} />}>
      <Page>
        <PageHeader
          eyebrow="Almost there"
          title="Review your booking"
          subtitle="Check everything below. Nothing is charged until you pay on the next step."
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {issue && (
              <Alert tone="error" role="alert">
                {issue} Edit your stay details to continue.
              </Alert>
            )}

            {/* What you're reserving */}
            <Card pad={false} className="overflow-hidden rounded-[1.25rem]">
              <div className="flex flex-col sm:flex-row">
                <div className="h-48 w-full shrink-0 bg-sand sm:h-auto sm:w-44">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge>{room.style}</Badge>
                    <span className="flex items-center gap-1 text-xs font-medium text-ink/60">
                      <Star size={13} className="fill-coral text-coral" aria-hidden="true" />
                      {room.rating} ({room.reviewCount})
                    </span>
                  </div>
                  <h2 className="font-serif text-xl text-forest">{room.name}</h2>
                  <p className="mt-1 text-xs text-ink/55">
                    {room.view} · {room.sqm} sqm
                  </p>
                </div>
              </div>
            </Card>

            {/* Stay details */}
            <Card>
              <CardTitle
                action={editBtn(editingStay, () => setEditingStay((v) => !v))}
              >
                Stay details
              </CardTitle>

              {!editingStay ? (
                <dl className="divide-y divide-forest/10">
                  <DetailRow label="Check-in" value={formatDate(draft.checkIn, LONG_DATE)} />
                  <DetailRow label="Check-out" value={formatDate(draft.checkOut, LONG_DATE)} />
                  <DetailRow
                    label="Length of stay"
                    value={`${nights} night${nights !== 1 ? "s" : ""}`}
                  />
                  <DetailRow
                    label="Guests"
                    value={guestsLabel(draft.adults, draft.children)}
                  />
                </dl>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <AvailabilityDatePicker
                      label="Check-in date"
                      value={draft.checkIn}
                      onChange={(value) => set("checkIn", value)}
                      roomId={room.id}
                      isRoomAvailable={isRoomAvailable}
                      mode="checkIn"
                      min={todayISO()}
                      error={issue}
                    />
                    <AvailabilityDatePicker
                      label="Check-out date"
                      value={draft.checkOut}
                      onChange={(value) => set("checkOut", value)}
                      roomId={room.id}
                      isRoomAvailable={isRoomAvailable}
                      mode="checkOut"
                      rangeStart={draft.checkIn}
                      min={
                        draft.checkIn
                          ? addDays(draft.checkIn, room.minNights)
                          : todayISO()
                      }
                      error={issue}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <GuestStepper
                      label="Adults"
                      value={draft.adults}
                      min={1}
                      max={Math.max(1, room.maxGuests - draft.children)}
                      onChange={(v) => set("adults", v)}
                    />
                    <GuestStepper
                      label="Children"
                      value={draft.children}
                      min={0}
                      max={Math.max(0, room.maxGuests - draft.adults)}
                      onChange={(v) => set("children", v)}
                    />
                  </div>

                  {issue && <Alert tone="error">{issue}</Alert>}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingStay(false)}
                    disabled={Boolean(issue)}
                  >
                    Save changes
                  </Button>
                </div>
              )}
            </Card>

            {/* Guest info */}
            <Card>
              <CardTitle
                action={editBtn(
                  editingGuest,
                  () => (editingGuest ? saveGuest() : setEditingGuest(true)),
                  "Done"
                )}
              >
                Primary guest
              </CardTitle>

              {!editingGuest ? (
                <dl className="divide-y divide-forest/10">
                  <DetailRow label="Full name" value={draft.fullName} />
                  <DetailRow label="Email address" value={draft.email} />
                  <DetailRow label="Phone number" value={draft.phone} />
                  <DetailRow
                    label="Special requests"
                    value={draft.specialRequests || "None added"}
                  />
                </dl>
              ) : (
                <div className="space-y-4">
                  <Field label="Full name" error={guestErrors.fullName}>
                    <input
                      type="text"
                      autoComplete="name"
                      value={draft.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                      className={cx(inputCls, guestErrors.fullName && inputErrCls)}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Email address" error={guestErrors.email}>
                      <input
                        type="email"
                        autoComplete="email"
                        value={draft.email}
                        onChange={(e) => set("email", e.target.value)}
                        className={cx(inputCls, guestErrors.email && inputErrCls)}
                      />
                    </Field>
                    <Field label="Phone number" error={guestErrors.phone}>
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={draft.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        className={cx(inputCls, guestErrors.phone && inputErrCls)}
                      />
                    </Field>
                  </div>
                  <Field label="Special requests" optional>
                    <textarea
                      value={draft.specialRequests}
                      onChange={(e) => set("specialRequests", e.target.value)}
                      rows={3}
                      className={textareaCls}
                    />
                  </Field>
                  <Button variant="secondary" size="sm" onClick={saveGuest}>
                    Save changes
                  </Button>
                </div>
              )}
            </Card>

            {breakfastItems.length > 0 && (
              <Card>
                <CardTitle>Breakfast add-on</CardTitle>
                <dl className="divide-y divide-forest/10">
                  {breakfastItems.map((item) => (
                    <DetailRow
                      key={item.itemId}
                      label={`${item.name} × ${item.quantity}`}
                      value={`₱${formatMoney(Number(item.price) * item.quantity)}`}
                    />
                  ))}
                </dl>
                <p className="mt-4 text-xs text-ink/55">Breakfast is included in your room booking payment.</p>
              </Card>
            )}

            {/* Cancellation */}
            <Card>
              <CardTitle>Cancellation policy</CardTitle>
              <p className="mb-3 text-sm leading-relaxed text-ink/70">
                {policyExpanded ? CANCELLATION_DETAILS : CANCELLATION_SUMMARY}
              </p>
              <button
                type="button"
                onClick={() => setPolicyExpanded((v) => !v)}
                aria-expanded={policyExpanded}
                className="flex items-center gap-1 text-sm font-semibold text-coral hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
              >
                {policyExpanded ? "Show less" : "View full policy"}
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cx("transition-transform", policyExpanded && "rotate-180")}
                />
              </button>
            </Card>

            <Link
              to="/booking"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back to booking details
            </Link>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <PriceSummary
              room={room}
              draft={draft}
              nights={nights}
              pricing={pricing}
              breakfastItems={breakfastItems}
              note="SSL secured payment gateway"
            >
              <Button
                size="lg"
                block
                className="mt-5"
                onClick={() => navigate("/booking/payment")}
                disabled={Boolean(issue) || editingGuest || editingStay}
              >
                <CheckCircle2 size={16} aria-hidden="true" /> Proceed to payment
              </Button>
              <p className="mt-3 text-center text-xs text-ink/50">
                {editingGuest || editingStay
                  ? "Save your changes to continue."
                  : "You'll be taken to our secure payment page next."}
              </p>
            </PriceSummary>
          </div>
        </div>
      </Page>
    </PageShell>
  );
}