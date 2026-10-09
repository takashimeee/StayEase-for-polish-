import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Coffee, Minus, Plus, ShieldCheck, Users } from "lucide-react";
import AvailabilityDatePicker from "../components/AvailabilityDatePicker";
import PageShell from "../components/PageShell";
import Stepper from "../components/Stepper";
import GuestStepper from "../components/GuestStepper";
import PriceSummary from "../components/PriceSummary";
import {
  Alert,
  Button,
  Card,
  Field,
  Page,
  PageHeader,
  cx,
  inputCls,
  inputErrCls,
  textareaCls,
} from "../components/ui";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import {
  EMAIL_PATTERN,
  addDays,
  calcPricing,
  formatMoney,
  nightsBetween,
  stayIssue,
  todayISO,
} from "../lib/utils";

export default function Booking() {
  const { draft, findRoom } = useApp();
  const room = findRoom(draft?.roomId);

  if (!draft || !room) return <Navigate to="/rooms" replace />;

  return <BookingInner draft={draft} room={room} />;
}

function SectionHeading({ step, title, hint }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white"
      >
        {step}
      </span>
      <div>
        <h2 className="font-serif text-xl text-forest">{title}</h2>
        <p className="text-xs text-ink/55">{hint}</p>
      </div>
    </div>
  );
}

function BookingInner({ draft, room }) {
  const { setDraft, isRoomAvailable, user } = useApp();
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});
  const [breakfastDishes, setBreakfastDishes] = useState([]);
  const [breakfastStatus, setBreakfastStatus] = useState("loading");
  const [breakfastError, setBreakfastError] = useState("");

  useEffect(() => {
    let current = true;
    api("/menu")
      .then((data) => {
        if (!current) return;
        const category = (data.categories || []).find((entry) => entry.slug === "breakfast");
        setBreakfastDishes(category?.items || []);
        setBreakfastStatus("ready");
      })
      .catch((err) => {
        if (!current) return;
        setBreakfastError(err.message || "We couldn't load breakfast options.");
        setBreakfastStatus("error");
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setDraft((d) =>
      d && !d.fullName && !d.email
        ? {
            ...d,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone || "",
          }
        : d
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };

      if (key === "checkIn" && next.checkOut <= value) {
        next.checkOut = addDays(value, room.minNights);
      }

      return next;
    });

    setErrors((e) => ({
      ...e,
      [key]: undefined,
      stay: undefined,
    }));
  };

  const nights = nightsBetween(draft.checkIn, draft.checkOut);

  const available =
    nights > 0
      ? isRoomAvailable(room.id, draft.checkIn, draft.checkOut)
      : true;

  const issue = stayIssue({
    room,
    ...draft,
    available,
  });

  const pricing = calcPricing(room, nights);
  const stayError = errors.stay || issue;
  const breakfastItems = (draft.breakfastItems || []).filter((item) => item.quantity > 0);

  const changeBreakfastQuantity = (dish, change) => {
    setDraft((current) => {
      const selections = current.breakfastItems || [];
      const selected = selections.find((item) => Number(item.itemId) === Number(dish.id));
      const quantity = Math.max(0, Math.min(20, (selected?.quantity || 0) + change));
      const next = selections.filter((item) => Number(item.itemId) !== Number(dish.id));
      if (quantity > 0) {
        next.push({ itemId: dish.id, name: dish.name, price: dish.price, quantity });
      }
      return { ...current, breakfastItems: next };
    });
  };

  const handleContinue = () => {
    const next = {};

    if (issue) next.stay = issue;
    if (!draft.fullName.trim()) {
      next.fullName = "Enter the guest's full name.";
    }
    if (!EMAIL_PATTERN.test(draft.email)) {
      next.email = "Enter a valid email address.";
    }
    if (draft.phone.trim().replace(/\D/g, "").length < 7) {
      next.phone = "Enter a valid phone number.";
    }

    setErrors(next);

    if (Object.keys(next).length === 0) {
      navigate("/booking/review");
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <PageShell stepper={<Stepper current={0} />}>
      <Page>
        <PageHeader
          eyebrow="Reservation"
          title="Complete your booking"
          subtitle="A few details and you'll be ready for your stay."
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-9">
            {/* Selected room */}
            <section aria-labelledby="selected-room">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">
                Your accommodation
              </span>
              <h2
                id="selected-room"
                className="mb-3 mt-1 font-serif text-xl text-forest"
              >
                Selected room
              </h2>

              <Card
                pad={false}
                className="overflow-hidden rounded-[1.25rem] shadow-[0_10px_35px_rgba(38,67,52,0.06)]"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="h-52 w-full shrink-0 bg-sand sm:h-auto sm:w-48">
                    <img
                      src={room.image}
                      alt={room.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center p-5 sm:p-6">
                    <h3 className="font-serif text-2xl tracking-[-0.02em] text-forest">
                      {room.name}
                    </h3>

                    <p className="mt-1.5 text-sm text-ink/60">
                      ₱{formatMoney(room.price)} per night
                    </p>

                    <p className="mt-3 text-xs text-ink/55">
                      Up to {room.maxGuests} guests · {room.minNights}-night
                      minimum
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* Stay details */}
            <section aria-labelledby="stay-details">
              <SectionHeading
                step="01"
                title="Stay details"
                hint="When will you be staying with us? Reserved nights are greyed out."
              />

              <Card className="rounded-[1.25rem] shadow-[0_8px_30px_rgba(38,67,52,0.04)]">
                <div id="stay-details" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <AvailabilityDatePicker
                    label="Check-in date"
                    value={draft.checkIn}
                    onChange={(value) => set("checkIn", value)}
                    roomId={room.id}
                    isRoomAvailable={isRoomAvailable}
                    mode="checkIn"
                    min={todayISO()}
                    error={stayError}
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
                    error={stayError}
                  />
                </div>

                {stayError && (
                  <Alert tone="error" className="mt-5">
                    {stayError}
                  </Alert>
                )}

                <div className="my-6 h-px bg-forest/[0.08]" />

                <div className="mb-4 flex items-center gap-2">
                  <Users size={16} className="text-coral" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">
                    Who's staying?
                  </span>
                  <span className="text-xs text-ink/45">
                    · up to {room.maxGuests} guests
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GuestStepper
                    tone="white"
                    label="Adults"
                    value={draft.adults}
                    min={1}
                    max={Math.max(1, room.maxGuests - draft.children)}
                    onChange={(v) => set("adults", v)}
                  />

                  <GuestStepper
                    tone="white"
                    label="Children"
                    value={draft.children}
                    min={0}
                    max={Math.max(0, room.maxGuests - draft.adults)}
                    onChange={(v) => set("children", v)}
                    hint="Ages 2–12 · no charge"
                  />
                </div>
              </Card>
            </section>

            {/* Guest information */}
            <section aria-labelledby="guest-info">
              <SectionHeading
                step="02"
                title="Guest information"
                hint="We'll use these details for your reservation."
              />

              <Card className="rounded-[1.25rem] shadow-[0_8px_30px_rgba(38,67,52,0.04)]">
                <div id="guest-info" className="space-y-5">
                  <Field label="Full name" error={errors.fullName}>
                    <input
                      type="text"
                      autoComplete="name"
                      value={draft.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                      placeholder="Sarah Jenkins"
                      className={cx(inputCls, errors.fullName && inputErrCls)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Email address" error={errors.email}>
                      <input
                        type="email"
                        autoComplete="email"
                        value={draft.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="sarah.jenkins@example.com"
                        className={cx(inputCls, errors.email && inputErrCls)}
                      />
                    </Field>

                    <Field label="Phone number" error={errors.phone}>
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={draft.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="+63 917 123 4567"
                        className={cx(inputCls, errors.phone && inputErrCls)}
                      />
                    </Field>
                  </div>

                  <Field label="Special requests" optional>
                    <textarea
                      value={draft.specialRequests}
                      onChange={(e) => set("specialRequests", e.target.value)}
                      placeholder="Let us know if there's anything that would make your stay more comfortable..."
                      rows={4}
                      className={textareaCls}
                    />
                  </Field>
                </div>
              </Card>
            </section>

            {/* Breakfast add-on */}
            <section aria-label="Breakfast add-on">
              <SectionHeading
                step="03"
                title="Add breakfast to your stay"
                hint="Breakfast is available to signed-in guests and is paid with your room booking."
              />
              <Card className="rounded-[1.25rem] shadow-[0_8px_30px_rgba(38,67,52,0.04)]">
                {breakfastStatus === "loading" && (
                  <p role="status" className="text-sm text-ink/60">Loading breakfast options…</p>
                )}
                {breakfastStatus === "error" && (
                  <Alert tone="error">{breakfastError}</Alert>
                )}
                {breakfastStatus === "ready" && breakfastDishes.length === 0 && (
                  <p className="text-sm text-ink/60">Breakfast options are not available right now.</p>
                )}
                {breakfastStatus === "ready" && breakfastDishes.length > 0 && (
                  <ul className="divide-y divide-forest/10">
                    {breakfastDishes.map((dish) => {
                      const quantity =
                        breakfastItems.find((item) => Number(item.itemId) === Number(dish.id))?.quantity || 0;
                      return (
                        <li key={dish.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                              <Coffee size={16} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-forest">{dish.name}</p>
                              {dish.description && <p className="mt-1 text-xs leading-5 text-ink/55">{dish.description}</p>}
                              <p className="mt-1 text-sm font-semibold text-coral">₱{formatMoney(dish.price)}</p>
                              {!dish.available && <p className="mt-1 text-xs font-medium text-[#B3453F]">Sold out</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => changeBreakfastQuantity(dish, -1)}
                              disabled={!quantity}
                              aria-label={`Remove one ${dish.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-forest/15 text-forest hover:bg-mint disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus size={15} aria-hidden="true" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold text-forest">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeBreakfastQuantity(dish, 1)}
                              disabled={!dish.available || quantity >= 20}
                              aria-label={`Add one ${dish.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-forest/15 text-forest hover:bg-mint disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </section>

            {errorCount > 0 && (
              <Alert tone="error" role="alert">
                Please check the highlighted fields above before continuing.
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs leading-5 text-ink/50">
                <ShieldCheck size={14} className="text-forest" aria-hidden="true" />
                You'll review everything before paying.
              </p>

              <Button
                size="lg"
                onClick={handleContinue}
                className="w-full px-7 sm:w-auto"
              >
                Continue to review
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            <PriceSummary
              room={room}
              draft={draft}
              nights={nights}
              pricing={pricing}
              breakfastItems={breakfastItems}
            />
          </div>
        </div>
      </Page>
    </PageShell>
  );
}