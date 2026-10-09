import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Award, Calendar, Coffee, Droplets, Heart, Navigation, Search, Wifi } from "lucide-react";

import TopRatedRooms from '../components/TopRatedRooms';
import PageShell from "../components/PageShell";
import RoomCard from "../components/RoomCard";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";

import { Badge, Button, Chip, DetailRow, EmptyState, SectionHeading } from "../components/ui";
import { GUEST_OPTIONS, HERO_IMAGE, getGuestOption } from "../data/rooms";
import { addDays, calcPricing, formatDate, formatMoney, nightsBetween, stayIssue, todayISO } from "../lib/utils";

const AMENITIES = [
  { label: "Ocean Pool", icon: Droplets, detail: "A quiet place to unwind" },
  { label: "Forest Spa", icon: Heart, detail: "Slow down and recharge" },
  { label: "Boutique Bistro", icon: Coffee, detail: "Fresh meals on property" },
  { label: "High-speed Wi-Fi", icon: Wifi, detail: "Stay connected when needed" },
  { label: "Private Parking", icon: Navigation, detail: "Easy arrival and departure" },
  { label: "Artisanal Breakfast", icon: Award, detail: "A thoughtful start each day" },
];

const CONTAINER = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10";

const cell =
  "block rounded-xl px-4 py-3 transition-colors hover:bg-cream focus-within:bg-cream";
const cellLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/50";
const cellInput = "w-full cursor-pointer bg-transparent text-sm font-semibold text-ink outline-none";

function SearchBar() {
  const { search, setSearch } = useApp();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setSearch((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "checkIn" && next.checkIn && next.checkOut && next.checkOut <= next.checkIn) {
        next.checkOut = addDays(next.checkIn, 1);
      }
      return next;
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate("/rooms");
      }}
      aria-label="Search availability"
      className="rounded-2xl bg-white p-3 shadow-[0_22px_60px_rgba(38,67,52,0.14)] sm:p-4"
    >
      <div className="grid grid-cols-1 gap-1 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:gap-2">
        <label className={cell}>
          <span className={cellLabel}>Check in</span>
          <input type="date" name="checkIn" min={todayISO()} value={search.checkIn} onChange={handleChange} required className={cellInput} />
        </label>

        <label className={cell}>
          <span className={cellLabel}>Check out</span>
          <input type="date" name="checkOut" min={search.checkIn} value={search.checkOut} onChange={handleChange} required className={cellInput} />
        </label>

        <label className={cell}>
          <span className={cellLabel}>Guests</span>
          <select name="guests" value={search.guests} onChange={handleChange} className={cellInput}>
            {GUEST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" size="lg" className="mt-2 px-7 md:mt-0">
          <Search size={16} aria-hidden="true" />
          Check availability
        </Button>
      </div>
    </form>
  );
}

function RoomDialog({ room, search, onClose, onContinue }) {
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const pricing = calcPricing(room, nights);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Modal title={room.name} onClose={onClose}>
      <div className="mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-sand">
        {room.image && !imgFailed && (
          <img src={room.image} alt={room.name} className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
        )}
      </div>

      <Badge className="mb-3">{room.style}</Badge>

      <dl>
        <DetailRow label="Beds" value={room.beds} />
        <DetailRow label="Guest capacity" value={`Up to ${room.maxGuests} guests`} />
        <DetailRow
          label="Your dates"
          value={`${formatDate(search.checkIn, { month: "short", day: "numeric" })} – ${formatDate(search.checkOut, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })} (${nights} night${nights !== 1 ? "s" : ""})`}
        />
        <DetailRow label="Price" value={`₱${formatMoney(room.price)} / night`} />
        <DetailRow label="Estimated total" value={`₱${formatMoney(pricing.total)}`} strong />
      </dl>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as={Link} variant="outline" to={`/rooms/${room.id}`}>
          Full details
        </Button>
        <Button onClick={onContinue}>
          Continue booking
          <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </Modal>
  );
}

export default function Home() {
  const { rooms, roomStyles, search, isRoomAvailable, startDraft, user } = useApp();
  const navigate = useNavigate();

  const [activeStyle, setActiveStyle] = useState("All Styles");
  const [selectedRoom, setSelectedRoom] = useState(null);

  const guest = getGuestOption(search.guests);
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const firstName = user?.fullName?.split(" ")[0];

  const getStatus = (room) => {
    if (nights <= 0) return { bookable: true, reason: "" };

    const issue = stayIssue({
      room,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: guest.adults,
      children: guest.children,
      available: isRoomAvailable(room.id, search.checkIn, search.checkOut),
    });

    return { bookable: !issue, reason: issue || "" };
  };

  const bookable = rooms.filter((room) => getStatus(room).bookable);
  const visibleRooms = activeStyle === "All Styles" ? bookable : bookable.filter((room) => room.style === activeStyle);
  const popularRooms = rooms.filter((room) => room.popular);

  const handleContinue = (room) => {
    if (!getStatus(room).bookable) return;

    startDraft(room.id, {
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: guest.adults,
      children: guest.children,
    });

    setSelectedRoom(null);
    navigate("/booking");
  };

  return (
    <PageShell>
      {/* HERO */}
      <section
        className="relative overflow-hidden bg-forest text-white"
        style={
          HERO_IMAGE
            ? {
                backgroundImage: `linear-gradient(rgba(10,53,53,.55), rgba(10,53,53,.88)), url(${HERO_IMAGE})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,138,91,.16),transparent_30%)]" />

        <div className={`${CONTAINER} relative pb-28 pt-20 sm:pb-36 sm:pt-28`}>
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-coral">
            {firstName ? `Welcome back, ${firstName}` : "StayEase Resort · Book direct"}
          </p>

          <h1 className="max-w-2xl font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            A quieter stay,
            <br />
            booked directly.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
            Beautiful rooms, thoughtful amenities, and a more personal way to plan your stay, all through the resort itself.
          </p>

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-2 text-xs text-white/65">
            <li>Instant confirmation</li>
            <li>Secure payment</li>
            <li>Real-time availability</li>
          </ul>
        </div>
      </section>

      {/* SEARCH */}
      <div className={`${CONTAINER} relative z-10 -mt-14 sm:-mt-16`}>
        <SearchBar />
      </div>
      
      
      {/* RECOMMENDED */}
      <TopRatedRooms getStatus={getStatus} onBook={setSelectedRoom} />

      {/* POPULAR */}
      <section className={`${CONTAINER} scroll-mt-24 pb-20 pt-20 sm:pt-24`} id="popular">
        <SectionHeading
          title="Rooms worth slowing down for"
          subtitle="A small collection of spaces designed for restful mornings, easy afternoons, and comfortable nights."
        >
          <Button as={Link} to="/rooms" variant="outline" size="sm">
            Explore all rooms
          </Button>
        </SectionHeading>

        {popularRooms.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
            {popularRooms.map((room) => (
              <RoomCard key={room.id} room={room} status={getStatus(room)} onBook={() => setSelectedRoom(room)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/60">Popular rooms will appear here soon.</p>
        )}
      </section>

      {/* AVAILABLE */}
      <section className="scroll-mt-24 bg-mint/45" id="rooms">
        <div className={`${CONTAINER} py-20 sm:py-24`}>
          <SectionHeading title="Free for your dates" subtitle="Rooms that suit your dates and party size. Reserved nights are left out automatically." />

          <div className="mb-10 flex flex-wrap gap-2" role="group" aria-label="Filter rooms by style">
            {roomStyles.map((style) => (
              <Chip key={style} active={activeStyle === style} onClick={() => setActiveStyle(style)}>
                {style}
              </Chip>
            ))}
          </div>

          {visibleRooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room) => (
                <RoomCard key={room.id} room={room} status={getStatus(room)} onBook={() => setSelectedRoom(room)} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Nothing free for these dates"
              action={
                <Button as={Link} to="/rooms" variant="outline">
                  Change dates
                </Button>
              }
            >
              Try another date range or room style.
            </EmptyState>
          )}
        </div>
      </section>

      {/* AMENITIES */}
      <section className="scroll-mt-24 bg-forest text-white" id="amenities">
        <div className={`${CONTAINER} py-20 sm:py-24`}>
          <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">The StayEase experience</p>

              <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight tracking-[-0.025em] sm:text-5xl">
                Everything you need.
                <br />
                Nothing you don't.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
                Thoughtful essentials and small comforts, all in one place. Spend less time arranging your stay and more time enjoying it.
              </p>
            </div>

            <ul className="grid border-y border-white/10 sm:grid-cols-2">
              {AMENITIES.map(({ label, icon: Icon, detail }) => (
                <li key={label} className="group flex gap-4 border-b border-white/10 px-1 py-6 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-coral transition group-hover:bg-coral group-hover:text-white">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {selectedRoom && (
        <RoomDialog room={selectedRoom} search={search} onClose={() => setSelectedRoom(null)} onContinue={() => handleContinue(selectedRoom)} />
      )}
    </PageShell>
  );
}