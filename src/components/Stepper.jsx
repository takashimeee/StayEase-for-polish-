import React from "react";
import { Check } from "lucide-react";
import { cx } from "./ui";

// Matches the pages: Booking = 0, Review = 1, Payment = 2, Confirmation = 4 (all done).
const STEPS = ["Your stay", "Review", "Payment", "Confirmation"];

export default function Stepper({ current }) {
  const shown = Math.min(current, STEPS.length - 1);

  return (
    <nav aria-label="Booking progress" className="bg-cream/80 px-5 py-3.5 sm:px-8">
      <p className="mx-auto mb-2 max-w-3xl text-[11px] font-medium text-ink/55 sm:hidden">
        Step {shown + 1} of {STEPS.length} · <span className="font-semibold text-coral">{STEPS[shown]}</span>
      </p>

      <ol className="mx-auto flex max-w-3xl items-center">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;

          return (
            <React.Fragment key={label}>
              <li className="flex items-center gap-2.5" aria-current={active ? "step" : undefined}>
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all",
                    done && "bg-forest text-white",
                    active && "bg-coral text-white ring-4 ring-coral/15",
                    !done && !active && "bg-white text-ink/40 ring-1 ring-forest/10"
                  )}
                >
                  {done ? <Check size={13} strokeWidth={2.2} aria-hidden="true" /> : i + 1}
                  <span className="sr-only">{done ? " (completed)" : ""}</span>
                </span>

                <span
                  className={cx(
                    "hidden text-[11px] tracking-wide sm:inline",
                    active ? "font-semibold text-coral" : done ? "font-medium text-forest" : "text-ink/45"
                  )}
                >
                  {label}
                </span>
              </li>

              {i < STEPS.length - 1 && (
                <li
                  aria-hidden="true"
                  className={cx("mx-3 h-px flex-1 sm:mx-5", done ? "bg-forest/40" : "bg-forest/10")}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}