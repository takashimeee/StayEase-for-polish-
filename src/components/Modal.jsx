import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, wide = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  // Keep the latest onClose without re-running the effect on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        closeRef.current?.();
        return;
      }

      // Keep Tab inside the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex min-h-full items-center justify-center">
        <section
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cx(
            "w-full rounded-2xl bg-white text-ink shadow-2xl outline-none",
            wide ? "max-w-3xl" : "max-w-lg"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-forest/[0.08] px-6 py-5">
            <h2 id={titleId} className="font-serif text-xl tracking-[-0.015em] text-forest">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-forest/5 hover:text-forest focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/20"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </section>
      </div>
    </div>
  );
}