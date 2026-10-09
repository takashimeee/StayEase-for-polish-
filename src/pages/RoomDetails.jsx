import { useEffect, useState } from "react";
import AvailabilityDatePicker from "../components/AvailabilityDatePicker";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BedDouble, CalendarDays, Image as ImageIcon, Maximize, Mountain, ShieldCheck, Star, Users } from "lucide-react";
import PageShell from "../components/PageShell";
import Modal from "../components/Modal";
import RoomCard from "../components/RoomCard";
import { AMENITY_META } from "../components/amenityIcons";
import { Alert, Badge, Button, Card, Field, Page, Select, cx } from "../components/ui";
import { useApp } from "../context/AppContext";
import { GUEST_OPTIONS, getGuestOption } from "../data/rooms";
import { addDays, calcPricing, formatDate, formatMoney, nightsBetween, stayIssue, todayISO } from "../lib/utils";
import { api } from "../lib/api";

export default function RoomDetails() {
  const { id } = useParams();
  const { findRoom } = useApp();
  const room = findRoom(id);
  if (!room) return <Navigate to="/rooms" replace />;
  return <RoomDetailsInner key={room.id} room={room} />;
}

function RoomDetailsInner({ room }) {
  const { search, setSearch, isRoomAvailable, startDraft, rooms } = useApp();
  const navigate = useNavigate();

  const [active, setActive] = useState(0);
  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const [guestKey, setGuestKey] = useState(search.guests);
  const [showError, setShowError] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [reviewList, setReviewList] = useState([]);

  useEffect(() => {
    api(`/rooms/${room.id}/reviews`).then(setReviewList).catch(() => {});
  }, [room.id]);

  const gallery = room.gallery?.length ? room.gallery : [room.image].filter(Boolean);
  const guest = getGuestOption(guestKey);
  const nights = nightsBetween(checkIn, checkOut);
  const available = nights > 0 ? isRoomAvailable(room.id, checkIn, checkOut) : true;
  const issue = stayIssue({ room, checkIn, checkOut, adults: guest.adults, children: guest.children, available });
  const pricing = calcPricing(room, nights);

  const changeCheckIn = (value) => {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(addDays(value, room.minNights));
    setShowError(false);
  };

  const handleConfirm = () => {
    if (issue) {
      setShowError(true);
      return;
    }
    setSearch({ checkIn, checkOut, guests: guestKey });
    startDraft(room.id, { checkIn, checkOut, adults: guest.adults, children: guest.children });
    navigate("/booking");
  };

  const quickFacts = [
    { icon: Users, label: `${room.maxGuests} guests` },
    { icon: BedDouble, label: room.beds },
    { icon: Maximize, label: `${room.sqm} sqm` },
    { icon: Mountain, label: room.view },
  ];

  const recommendations = rooms.filter((r) => r.id !== room.id).slice(0, 3);
  const reviews = allReviews ? reviewList : reviewList.slice(0, 1);
  const bookable = !issue;

  const scrollToBooking = () => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <PageShell>
      <Page className="sm:py-10">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-sand sm:aspect-[16/8]">
            {gallery[active] && <img src={gallery[active]} alt={room.name} className="h-full w-full object-cover" />}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
            <button
              type="button"
              onClick={() => setPhotosOpen(true)}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-forest backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              <ImageIcon size={14} aria-hidden="true" /> View all {gallery.length} photos
            </button>
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={active === i}
                  className={cx(
                    "h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-sand transition focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/40 sm:h-20 sm:w-32",
                    active === i ? "ring-2 ring-coral" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Left */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-coral">
              {room.style}
              {room.location ? ` · ${room.location}` : ""}
            </p>
            <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.03em] text-forest sm:text-5xl">{room.name}</h1>

            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-y border-forest/[0.1] py-5 text-sm">
              {quickFacts.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 font-medium text-ink/80">
                  <Icon size={17} className="text-forest" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            <section className="mt-10">
              <h2 className="mb-4 font-serif text-2xl text-forest">The room</h2>
              {room.about.map((p, i) => (
                <p key={i} className="mb-4 max-w-2xl text-[15px] leading-7 text-ink/70">
                  {p}
                </p>
              ))}
            </section>

            <section className="mt-10">
              <h2 className="mb-5 font-serif text-2xl text-forest">What's included</h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                {room.amenities
                  .filter((key) => AMENITY_META[key])
                  .map((key) => {
                    const { icon: Icon, label } = AMENITY_META[key];
                    return (
                      <li key={key} className="flex items-center gap-3 text-sm text-ink/80">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        {label}
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="mt-12">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 font-serif text-2xl text-forest">
                  Guest reviews
                  {reviewList.length > 0 && (
                    <span className="flex items-center gap-1 font-sans text-sm font-semibold text-ink/70">
                      <Star size={14} className="fill-coral text-coral" aria-hidden="true" />
                      {room.rating}
                    </span>
                  )}
                </h2>
                {reviewList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAllReviews((v) => !v)}
                    className="text-sm font-semibold text-coral transition-colors hover:text-coral-dark"
                  >
                    {allReviews ? "Show fewer" : `See all ${reviewList.length}`}
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {reviews.length === 0 && <p className="text-sm text-ink/60">No reviews yet.</p>}

                {reviews.map((rv, i) => (
                  <figure key={`${rv.author}-${i}`} className="border-l-2 border-coral/40 pl-5">
                    <div className="mb-2 flex items-center gap-1 text-coral">
                      {Array.from({ length: 5 }).map((_, n) => (
                        <Star key={n} size={13} aria-hidden="true" className={n < rv.rating ? "fill-coral" : "text-ink/20"} />
                      ))}
                      <span className="ml-auto text-xs text-ink/50">{rv.date}</span>
                    </div>
                    {rv.text && <blockquote className="mb-3 font-serif text-lg leading-7 text-ink/80">"{rv.text}"</blockquote>}
                    <figcaption className="text-sm font-semibold text-forest">
                      {rv.author}
                      <span className="ml-2 text-xs font-normal text-ink/50">{rv.meta}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          </div>

          {/* Booking */}
          <aside id="book" className="h-fit scroll-mt-28 lg:sticky lg:top-28">
            <Card className="shadow-[0_20px_60px_rgba(38,67,52,0.1)]">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <span className="font-serif text-3xl font-semibold text-forest">₱{formatMoney(room.price)}</span>
                  <span className="text-sm text-ink/55"> / night</span>
                </div>
                <Badge tone={available && !issue?.includes("fits") ? "mint" : "coral"}>{available ? "Available" : "Booked"}</Badge>
              </div>

              <div className="space-y-4">
                <AvailabilityDatePicker
                  label="Check-in"
                  value={checkIn}
                  onChange={changeCheckIn}
                  roomId={room.id}
                  isRoomAvailable={isRoomAvailable}
                  mode="checkIn"
                  min={todayISO()}
                />

                <AvailabilityDatePicker
                  label="Check-out"
                  value={checkOut}
                  onChange={(value) => {
                    setCheckOut(value);
                    setShowError(false);
                  }}
                  roomId={room.id}
                  isRoomAvailable={isRoomAvailable}
                  mode="checkOut"
                  rangeStart={checkIn}
                  min={checkIn ? addDays(checkIn, room.minNights) : todayISO()}
                />

                <Field label="Guests">
                  <Select
                    value={guestKey}
                    onChange={(e) => {
                      setGuestKey(e.target.value);
                      setShowError(false);
                    }}
                  >
                    {GUEST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <p className="my-5 flex items-center justify-center gap-1.5 text-xs text-ink/55" aria-live="polite">
                <CalendarDays size={13} aria-hidden="true" />
                {nights > 0
                  ? `${nights} night${nights > 1 ? "s" : ""} · ${formatDate(checkIn, { month: "short", day: "numeric" })} – ${formatDate(checkOut, { month: "short", day: "numeric" })}`
                  : "Pick a check-out date after check-in"}
              </p>

              <div className="space-y-2 border-t border-forest/10 pt-4 text-sm">
                <div className="flex justify-between text-ink/70">
                  <span>
                    ₱{formatMoney(room.price)} × {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                  <span>₱{formatMoney(pricing.subtotal)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Resort fees &amp; taxes</span>
                  <span>₱{formatMoney(pricing.fees)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Service fee</span>
                  <span>₱{formatMoney(pricing.service)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-forest/10 pt-3 text-forest">
                  <span className="font-semibold">Total</span>
                  <span className="font-serif text-2xl font-semibold">₱{formatMoney(pricing.total)}</span>
                </div>
              </div>

              <Button size="lg" block className={cx("mt-5", !bookable && "opacity-60")} onClick={handleConfirm} aria-disabled={!bookable}>
                Reserve this room
              </Button>

              {(showError || (issue && nights > 0)) && issue && (
                <Alert tone="error" className="mt-3">
                  {issue}
                </Alert>
              )}

              <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-5 text-ink/50">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest/60" aria-hidden="true" />
                Booking direct with the resort. You won't pay until the final step, and cancellation is free up to 48 hours before check-in.
              </p>
            </Card>
          </aside>
        </div>

        {/* More rooms */}
        <section className="mt-20">
          <div className="mb-8 flex items-end justify-between gap-3">
            <h2 className="font-serif text-3xl text-forest">You might also like</h2>
            <Link to="/rooms" className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral transition-all hover:gap-2.5">
              All rooms <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-3">
            {recommendations.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                status={{ bookable: true, reason: "" }}
                onBook={() => navigate(`/rooms/${r.id}`)}
              />
            ))}
          </div>
        </section>

        <div className="h-20 lg:hidden" aria-hidden="true" />
      </Page>

      {/* Mobile booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 bg-white/95 px-5 py-3 shadow-[0_-10px_30px_rgba(38,67,52,0.1)] backdrop-blur lg:hidden">
        <p className="text-xs text-ink/55">
          <span className="font-serif text-xl font-semibold text-forest">₱{formatMoney(room.price)}</span> / night
        </p>
        <Button onClick={scrollToBooking}>Check dates</Button>
      </div>

      {photosOpen && (
        <Modal title={`${room.name} — Photos`} onClose={() => setPhotosOpen(false)} wide>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gallery.map((src, i) => (
              <img key={src} src={src} alt={`${room.name} photo ${i + 1}`} className="aspect-[4/3] w-full rounded-lg bg-sand object-cover" />
            ))}
          </div>
        </Modal>
      )}
    </PageShell>
  );
}