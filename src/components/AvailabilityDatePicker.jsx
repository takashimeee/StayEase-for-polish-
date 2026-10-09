import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { addDays, formatDate, todayISO } from "../lib/utils";
import { cx } from "./ui";

function parseISODate(value) {
  return value ? new Date(`${value}T12:00:00`) : new Date();
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export default function AvailabilityDatePicker({
  label,
  value,
  onChange,
  roomId,
  isRoomAvailable,
  mode = "checkIn",
  rangeStart = "",
  min = todayISO(),
  error,
  hint,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const [month, setMonth] = useState(() => firstOfMonth(parseISODate(value || min)));

  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on outside click; Escape closes only the picker (not a parent modal).
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    if (!open) {
      // Reopen on the selected month, and flip upward when there isn't room below.
      setMonth(firstOfMonth(parseISODate(value || min)));
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const below = window.innerHeight - rect.bottom;
        setFlipUp(below < 400 && rect.top > below);
      }
    }
    setOpen((v) => !v);
  };

  const cells = useMemo(() => {
    const first = firstOfMonth(month);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  /** Dates that can never be chosen regardless of reservations. */
  const isUnselectable = (iso) => {
    if (iso < min) return true;
    if (mode === "checkOut" && (!rangeStart || iso <= rangeStart)) return true;
    return false;
  };

  /** Uses the existing availability logic only. */
  const isReserved = (iso) => {
    if (isUnselectable(iso)) return false;

    // Check-in: the room must be free for the night starting on this date.
    if (mode === "checkIn") return !isRoomAvailable(roomId, iso, addDays(iso, 1));

    // Check-out: the whole stay from check-in to this date must be free.
    return !isRoomAvailable(roomId, rangeStart, iso);
  };

  const display = value
    ? formatDate(value, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : `Select ${mode === "checkIn" ? "check-in" : "check-out"}`;

  const choose = (date) => {
    const iso = toISO(date);
    if (isUnselectable(iso) || isReserved(iso)) return;

    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const minimumMonth = firstOfMonth(parseISODate(min));
  const today = todayISO();
  const showRange = mode === "checkOut" && rangeStart && value;

  return (
    <div
      ref={rootRef}
      className={cx("relative", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/65">
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        className={cx(
          "flex h-12 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/10",
          error ? "border-red-400" : "border-forest/[0.14] hover:border-forest/30"
        )}
      >
        <CalendarDays size={17} className="shrink-0 text-coral" aria-hidden="true" />
        <span className={cx("min-w-0 flex-1 truncate text-sm", value ? "text-ink" : "text-ink/40")}>
          {display}
        </span>
      </button>

      {hint && !error && <p className="mt-2 text-xs text-ink/50">{hint}</p>}

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className={cx(
            "absolute left-0 z-40 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-forest/10 bg-white p-4 shadow-[0_24px_70px_rgba(38,67,52,0.18)]",
            flipUp ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]"
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              disabled={month <= minimumMonth}
              className="rounded-full p-2 text-ink/55 transition hover:bg-cream hover:text-forest focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15 disabled:opacity-30"
              aria-label="Previous month"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="font-serif text-base text-forest" aria-live="polite">
              {monthLabel(month)}
            </div>

            <button
              type="button"
              onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded-full p-2 text-ink/55 transition hover:bg-cream hover:text-forest focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15"
              aria-label="Next month"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-ink/40">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((date) => {
              const iso = toISO(date);
              const outside = date.getMonth() !== month.getMonth();
              const unselectable = isUnselectable(iso);
              const reserved = isReserved(iso);
              const blocked = unselectable || reserved;
              const selected = value === iso;
              const inRange = showRange && iso > rangeStart && iso < value;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={blocked}
                  onClick={() => choose(date)}
                  aria-pressed={selected}
                  aria-label={`${formatDate(iso, { month: "long", day: "numeric", year: "numeric" })}${
                    reserved ? ", reserved" : ""
                  }`}
                  title={reserved ? "Reserved" : undefined}
                  className={cx(
                    "relative h-9 rounded-lg text-xs font-medium transition",
                    "focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15",
                    outside && !selected && "opacity-40",
                    !blocked && !selected && "text-ink hover:bg-mint hover:text-forest",
                    inRange && "rounded-none bg-mint/70",
                    unselectable && "cursor-not-allowed text-ink/20",
                    reserved && "cursor-not-allowed bg-sand/50 text-ink/35 line-through decoration-ink/30",
                    iso === today && !selected && !blocked && "ring-1 ring-inset ring-forest/25",
                    selected && "bg-coral text-white hover:bg-coral"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-forest/10 pt-3 text-[11px] text-ink/50">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded bg-coral" />
              Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded bg-sand" />
              Reserved
            </span>
          </div>
        </div>
      )}
    </div>
  );
}