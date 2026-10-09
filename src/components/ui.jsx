import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2 } from "lucide-react";

/**
 * StayEase shared UI kit.
 * Editorial hospitality: warm surfaces, quiet borders, Fraunces headings,
 * Inter controls, coral reserved for meaningful actions.
 */

export const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ---------------- Layout ---------------- */

const WIDTH = {
  xs: "max-w-xl",
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
};

export function Page({ width = "lg", className, children }) {
  return (
    <main
      className={cx(
        "mx-auto w-full px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16",
        WIDTH[width],
        className
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action, className }) {
  return (
    <div
      className={cx(
        "mb-10 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">
            {eyebrow}
          </p>
        )}

        <h1 className="max-w-3xl font-serif text-[2.35rem] leading-[1.04] tracking-[-0.035em] text-forest sm:text-5xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-ink/60">{subtitle}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionHeading({ title, subtitle, center, light, children, className }) {
  return (
    <div
      className={cx(
        "mb-10 flex flex-wrap items-end justify-between gap-5",
        center && "justify-center text-center",
        className
      )}
    >
      <div className={center ? "mx-auto max-w-2xl" : "min-w-0"}>
        <h2
          className={cx(
            "font-serif text-[1.75rem] leading-tight tracking-[-0.025em] sm:text-[2rem]",
            light ? "text-white" : "text-forest"
          )}
        >
          {title}
        </h2>

        {subtitle && (
          <p className={cx("mt-2.5 max-w-xl text-sm leading-6", light ? "text-white/65" : "text-ink/60")}>
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ as: Tag = "div", pad = true, className, children, ...props }) {
  return (
    <Tag
      className={cx(
        "rounded-2xl border border-forest/[0.06] bg-white shadow-[0_10px_40px_rgba(38,67,52,0.06)]",
        pad && "p-5 sm:p-7",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({ children, action, className }) {
  return (
    <div
      className={cx(
        "mb-5 flex items-center justify-between gap-4 border-b border-forest/[0.08] pb-4",
        className
      )}
    >
      <h2 className="font-serif text-xl tracking-[-0.015em] text-forest">{children}</h2>
      {action}
    </div>
  );
}

/* ---------------- Buttons ---------------- */

const VARIANT = {
  primary:
    "bg-coral text-white shadow-[0_7px_20px_rgba(201,85,47,0.16)] hover:bg-coral-dark hover:shadow-[0_9px_25px_rgba(201,85,47,0.22)] focus-visible:ring-coral/30",
  secondary: "bg-forest text-white shadow-sm hover:bg-forest-dark focus-visible:ring-forest/30",
  outline:
    "border border-forest/20 bg-white text-forest hover:border-forest/35 hover:bg-mint/50 focus-visible:ring-forest/20",
  ghost: "text-forest hover:bg-forest/5 focus-visible:ring-forest/20",
  danger:
    "border border-[#B3453F]/25 bg-white text-[#B3453F] hover:bg-[#FBEAEA] focus-visible:ring-[#B3453F]/20",
  dangerSolid: "bg-[#B3453F] text-white hover:bg-[#9B3A35] focus-visible:ring-[#B3453F]/30",
};

// "h-13" isn't a default Tailwind step, so the large size uses an explicit value.
const SIZE = {
  sm: "h-9 gap-1.5 px-3.5 text-xs",
  md: "h-11 gap-2 px-5 text-sm",
  lg: "h-[3.25rem] gap-2 px-6 text-sm",
};

export function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  block,
  loading,
  className,
  type,
  disabled,
  children,
  ...props
}) {
  const extra = Tag === "button" ? { type: type || "button" } : {};
  const isDisabled = disabled || loading;

  return (
    <Tag
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold tracking-[-0.005em]",
        "transition-all duration-200",
        "focus:outline-none focus-visible:ring-4",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
        "active:translate-y-px",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...extra}
      {...props}
    >
      {loading && <Spinner size={15} />}
      {children}
    </Tag>
  );
}

export function Spinner({ size = 16, className }) {
  return <Loader2 size={size} className={cx("animate-spin", className)} aria-hidden="true" />;
}

/* ---------------- Status ---------------- */

const BADGE = {
  mint: "bg-mint text-forest",
  sand: "bg-sand text-ink/70",
  danger: "bg-[#FBEAEA] text-[#B3453F]",
  coral: "bg-[#FDEBE6] text-[#C9552F]",
  dark: "bg-forest text-white",
};

export function Badge({ tone = "mint", className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        BADGE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const ALERT = {
  error: { cls: "border-[#F3C9BB] bg-[#FBE9E4] text-[#B84A27]", Icon: AlertTriangle, role: "alert" },
  success: { cls: "border-forest/10 bg-mint text-forest", Icon: CheckCircle2, role: "status" },
  info: { cls: "border-forest/[0.08] bg-cream text-ink/70", Icon: Info, role: "status" },
};

export function Alert({ tone = "info", icon = true, role, className, children }) {
  const { cls, Icon, role: defaultRole } = ALERT[tone];

  return (
    <div
      role={role || defaultRole}
      className={cx("flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6", cls, className)}
    >
      {icon && <Icon size={16} className="mt-1 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }) {
  // Pass your own vertical padding via className (e.g. "py-8"); default is py-16.
  return (
    <div className={cx("text-center", className || "py-16")}>
      {Icon && (
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-forest">
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
        </span>
      )}

      <h3 className="font-serif text-xl text-forest">{title}</h3>

      {children && <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/55">{children}</p>}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ---------------- Forms ---------------- */

export const inputCls =
  "h-12 w-full rounded-xl border border-forest/[0.14] bg-white px-4 text-sm text-ink outline-none transition-all duration-200 " +
  "placeholder:text-ink/35 hover:border-forest/25 " +
  "focus:border-forest focus:ring-4 focus:ring-forest/[0.08] " +
  "disabled:cursor-not-allowed disabled:bg-sand/40";

export const inputErrCls = "border-red-400 focus:border-red-500 focus:ring-red-100";

export const textareaCls =
  "w-full rounded-xl border border-forest/[0.14] bg-white px-4 py-3.5 text-sm leading-6 text-ink outline-none transition-all duration-200 " +
  "placeholder:text-ink/35 hover:border-forest/25 " +
  "focus:border-forest focus:ring-4 focus:ring-forest/[0.08] resize-none";

export function Field({ label, error, hint, optional, className, children }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/65">
        {label}
        {optional && (
          <span className="ml-1 font-normal normal-case tracking-normal text-ink/40">optional</span>
        )}
      </span>

      {children}

      {hint && !error && <span className="mt-2 block text-xs leading-5 text-ink/50">{hint}</span>}

      {error && (
        <span role="alert" className="mt-2 block text-xs leading-5 text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Select({ className, children, ...props }) {
  // If the caller passes its own height (e.g. "h-10"), drop the default h-12
  // so the two don't fight over CSS order.
  const base = /(^|\s)h-\S+/.test(className || "") ? inputCls.replace("h-12", "") : inputCls;

  return (
    <div className="relative">
      <select className={cx(base, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>

      <ChevronDown
        size={16}
        strokeWidth={1.7}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/35"
      />
    </div>
  );
}

export function Chip({ active, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "h-9 rounded-full border px-4 text-xs font-semibold transition-all duration-200",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/20",
        active
          ? "border-forest bg-forest text-white shadow-sm"
          : "border-forest/10 bg-white text-ink/65 hover:border-forest/25 hover:text-forest",
        className
      )}
      {...props}
    />
  );
}

export function Toggle({ title, description, on, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-forest/[0.08] py-5 last:border-0">
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 max-w-md text-xs leading-5 text-ink/55">{description}</div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={onToggle}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/20",
          on ? "bg-forest" : "bg-[#D9D2C4]"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            on ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-7 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/40">
      <span className="h-px flex-1 bg-forest/[0.08]" />
      or
      <span className="h-px flex-1 bg-forest/[0.08]" />
    </div>
  );
}

/* ---------------- Data display ---------------- */

export function DetailRow({ label, value, strong }) {
  return (
    <div className="flex justify-between gap-6 border-b border-forest/[0.07] py-3.5 text-sm last:border-0">
      <dt className="text-ink/55">{label}</dt>
      <dd className={cx("text-right text-ink", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}