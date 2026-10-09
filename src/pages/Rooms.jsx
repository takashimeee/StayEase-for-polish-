import { useState } from "react";
import { BedDouble } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RoomConcierge from "../components/RoomConcierge";
import PageShell from "../components/PageShell";
import RoomCard from "../components/RoomCard";
import TopRatedRooms from "../components/TopRatedRooms";
import { Alert, Button, Chip, EmptyState, Field, Page, PageHeader, Select, inputCls } from "../components/ui";
import { useApp } from "../context/AppContext";
import { GUEST_OPTIONS, getGuestOption } from "../data/rooms";
import { addDays, nightsBetween, stayIssue, todayISO } from "../lib/utils";

export default function Rooms() {
  const { rooms, roomStyles, search, setSearch, isRoomAvailable, startDraft } = useApp();
  const navigate = useNavigate();

  const [style, setStyle] = useState("All Styles");
  const [sort, setSort] = useState("recommended");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const guest = getGuestOption(search.guests);
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const datesOk = nights > 0;

  const onChange = (e) => {
    const { name, value } = e.target;
    setSearch((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "checkIn" && next.checkOut <= value) {
        next.checkOut = addDays(value, 1);
      }
      return next;
    });
  };

  const getStatus = (room) => {
  const reason = datesOk
    ? stayIssue({
        room,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        adults: guest.adults,
        children: guest.children,
        available: isRoomAvailable(room.id, search.checkIn, search.checkOut),
      })
    : "Pick valid dates to check availability.";
  return { bookable: !reason, reason };
};

  const rows = rooms
    .filter((r) => style === "All Styles" || r.style === style)
    .map((room) => {
      const reason = datesOk
        ? stayIssue({
            room,
            checkIn: search.checkIn,
            checkOut: search.checkOut,
            adults: guest.adults,
            children: guest.children,
            available: isRoomAvailable(room.id, search.checkIn, search.checkOut),
          })
        : "Pick valid dates to check availability.";

      return { room, status: { bookable: !reason, reason } };
    })
    .filter((row) => !onlyAvailable || row.status.bookable)
    .sort((a, b) => {
      if (sort === "low") return a.room.price - b.room.price;
      if (sort === "high") return b.room.price - a.room.price;
      if (sort === "rating") return b.room.rating - a.room.rating;
      return 0;
    });

  const book = (room) => {
    startDraft(room.id, {
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: guest.adults,
      children: guest.children,
    });
    navigate("/booking");
  };

  const resetFilters = () => {
    setStyle("All Styles");
    setOnlyAvailable(false);
    setSort("recommended");
  };
  
  
  return (
    <PageShell>
      <Page>
        <PageHeader
          eyebrow="Our rooms"
          title="Find your place to stay."
          subtitle="Choose your dates and we'll show which rooms are free for your stay."
        />

        {/* Dates */}
        <section
          aria-label="Your stay"
          className="mb-12 rounded-2xl bg-white p-5 shadow-[0_15px_50px_rgba(38,67,52,0.07)] sm:p-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <Field label="Check-in">
              <input type="date" name="checkIn" min={todayISO()} value={search.checkIn} onChange={onChange} className={inputCls} />
            </Field>

            <Field label="Check-out">
              <input type="date" name="checkOut" min={search.checkIn} value={search.checkOut} onChange={onChange} className={inputCls} />
            </Field>

            <Field label="Guests">
              <Select name="guests" value={search.guests} onChange={onChange}>
                {GUEST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <p className="pb-3 text-sm text-ink/55 md:min-w-[5.5rem]" aria-live="polite">
              {datesOk ? `${nights} night${nights !== 1 ? "s" : ""}` : ""}
            </p>
          </div>

          {!datesOk && (
            <Alert tone="error" className="mt-4">
              Check-out must be after check-in.
            </Alert>
          )}
        </section>

        <RoomConcierge />

        <TopRatedRooms contained={false} getStatus={getStatus} onBook={book} />

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-forest">
              {rows.length} room{rows.length !== 1 ? "s" : ""}
              {onlyAvailable || datesOk ? "" : ""}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter rooms by style">
              {roomStyles.map((s) => (
                <Chip key={s} active={style === s} onClick={() => setStyle(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-forest/30 accent-forest"
              />
              Only show available
            </label>

            <div className="w-52">
              <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort rooms" className="h-10 text-xs">
                <option value="recommended">Recommended</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </Select>
            </div>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ room, status }) => (
              <RoomCard key={room.id} room={room} status={status} onBook={() => book(room)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BedDouble}
            title="No rooms match right now"
            action={
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          >
            Try different dates, another room style, or a different party size.
          </EmptyState>
        )}
      </Page>
    </PageShell>
  );
}