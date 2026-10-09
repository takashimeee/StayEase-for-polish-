import { ShieldCheck, Star } from "lucide-react";
import {
  formatDate,
  formatMoney,
  guestsLabel,
} from "../lib/utils";

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-5 text-sm">
      <span className="text-ink/55">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export default function PriceSummary({
  room,
  draft,
  nights,
  pricing,
  breakfastItems = [],
  children,
  note,
}) {
  const breakfastTotal = breakfastItems.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const bookingTotal = pricing.total + breakfastTotal;

  const range =
    draft.checkIn && draft.checkOut
      ? `${formatDate(draft.checkIn, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} – ${formatDate(draft.checkOut, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : "Choose your dates";

  return (
    <aside className="h-fit overflow-hidden rounded-2xl border border-forest/[0.08] bg-white shadow-[0_15px_45px_rgba(38,67,52,0.07)] lg:sticky lg:top-28">
      {/* Room image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-sand">
        <img
          src={room.image}
          alt={room.name}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="absolute bottom-4 left-5 right-5">
          <p className="font-serif text-xl text-white">
            {room.name}
          </p>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-white/85">
            <Star
              size={13}
              className="fill-coral text-coral"
              aria-hidden="true"
            />
            {room.rating} · {room.reviewCount} reviews
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Stay */}
        <div className="space-y-3">
          <Row label="Dates" value={range} />

          <Row
            label="Length of stay"
            value={
              nights > 0
                ? `${nights} night${nights > 1 ? "s" : ""}`
                : "—"
            }
          />

          <Row
            label="Guests"
            value={guestsLabel(
              draft.adults,
              draft.children
            )}
          />
        </div>

        {/* Pricing */}
        <div className="mt-5 space-y-3 border-t border-forest/[0.08] pt-5">
          <Row
            label={`₱${room.price} × ${nights} night${
              nights !== 1 ? "s" : ""
            }`}
            value={`₱${formatMoney(pricing.subtotal)}`}
          />

          <Row
            label="Resort fees & taxes"
            value={`₱${formatMoney(pricing.fees)}`}
          />

          <Row
            label="Service fee"
            value={`₱${formatMoney(pricing.service)}`}
          />
          {breakfastItems.map((item) => (
            <Row
              key={item.itemId}
              label={`${item.name} × ${item.quantity}`}
              value={`₱${formatMoney(Number(item.price) * item.quantity)}`}
            />
          ))}
        </div>

        {/* Total */}
        <div className="mt-6 border-t border-forest/[0.08] pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink/40">
                Total stay
              </p>

              <p className="mt-1 font-serif text-xl text-forest">
                Your reservation
              </p>
            </div>

            <span className="font-serif text-[1.65rem] font-semibold tracking-[-0.025em] text-forest">
              ₱{formatMoney(bookingTotal)}
            </span>
          </div>
        </div>

        {children}

        <div className="mt-5 flex items-center justify-center gap-2 border-t border-forest/[0.08] pt-4 text-[11px] leading-5 text-ink/45">
          <ShieldCheck
            size={14}
            className="shrink-0 text-forest/60"
            aria-hidden="true"
          />

          <span>
            {note ?? "You won't be charged yet"}
          </span>
        </div>
      </div>
    </aside>
  );
}