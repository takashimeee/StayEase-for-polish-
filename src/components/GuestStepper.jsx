import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "./ui";

export default function GuestStepper({ label, value, min, max, onChange, tone = "cream", hint }) {
  const labelId = useId();

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-white text-forest transition-all " +
    "hover:border-forest/25 hover:bg-mint focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15 " +
    "disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div role="group" aria-labelledby={labelId}>
      <span
        id={labelId}
        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/65"
      >
        {label}
      </span>

      <div
        className={cx(
          "flex h-12 items-center justify-between rounded-xl px-2",
          tone === "cream"
            ? "border border-forest/[0.06] bg-cream"
            : "border border-forest/[0.14] bg-white"
        )}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className={btn}
        >
          <Minus size={13} strokeWidth={2} aria-hidden="true" />
        </button>

        <span className="min-w-[2ch] text-center text-sm font-semibold text-ink" aria-live="polite">
          {value}
        </span>

        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className={btn}
        >
          <Plus size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {hint && <p className="mt-2 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}