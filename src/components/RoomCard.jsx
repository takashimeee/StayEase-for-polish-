import { useState } from "react";
import { Link } from "react-router-dom";
import { Star, Users } from "lucide-react";
import { Button, cx } from "./ui";
import { formatMoney } from "../lib/utils";

export default function RoomCard({ room, status, onBook }) {
  const [failed, setFailed] = useState(false);
  const bookable = status?.bookable ?? true;
  const reason = status?.reason || "";
  const chips = (room.chips || []).slice(0, 3);

  return (
    <article className="group flex flex-col">
      <Link
        to={`/rooms/${room.id}`}
        aria-label={`View ${room.name}`}
        className="relative block overflow-hidden rounded-2xl bg-sand focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30"
      >
        <div className="aspect-[4/3]">
          {room.image && !failed && (
            <img
              src={room.image}
              alt={room.name}
              loading="lazy"
              onError={() => setFailed(true)}
              className={cx(
                "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                !bookable && "opacity-80 saturate-50"
              )}
            />
          )}
        </div>

        <span
          className={cx(
            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur",
            bookable ? "bg-white/90 text-forest" : "bg-ink/70 text-white"
          )}
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", bookable ? "bg-emerald-500" : "bg-white/60")} />
          {bookable ? "Available" : "Unavailable"}
        </span>
      </Link>

      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">{room.style}</p>
            <h3 className="font-serif text-2xl leading-tight tracking-[-0.02em] text-forest">{room.name}</h3>
          </div>

          {room.reviewCount > 0 && (
            <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink/60">
              <Star size={13} className="fill-coral text-coral" aria-hidden="true" />
              {room.rating}
            </span>
          )}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/55">
          <Users size={13} aria-hidden="true" />
          Up to {room.maxGuests} guests
          {room.beds ? <span> · {room.beds}</span> : null}
        </p>

        {chips.length > 0 && <p className="mt-2 text-xs leading-5 text-ink/50">{chips.join(" · ")}</p>}

        {!bookable && reason && <p className="mt-3 text-xs leading-5 text-ink/60">{reason}</p>}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-forest/[0.08] pt-4">
          <p className="text-xs text-ink/50">
            <span className="font-serif text-xl font-semibold text-forest">₱{formatMoney(room.price)}</span> / night
          </p>

          <div className="flex items-center gap-2">
            <Button as={Link} to={`/rooms/${room.id}`} variant="ghost" size="sm">
              View room
            </Button>
            <Button size="sm" onClick={onBook} disabled={!bookable}>
              Reserve
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}