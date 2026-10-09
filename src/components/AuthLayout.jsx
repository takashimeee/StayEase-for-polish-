import { Link } from "react-router-dom";
import { CalendarCheck, Clock, MapPin, ShieldCheck } from "lucide-react";
import { HERO_IMAGE } from "../data/rooms";

const POINTS = [
  { icon: CalendarCheck, text: "Instant booking confirmation" },
  { icon: ShieldCheck, text: "Secure direct reservations" },
  { icon: Clock, text: "Relaxed arrivals from 3:00 PM" },
];

function Brand({ light }) {
  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30 ${light ? "text-white" : "text-forest"}`}
      aria-label="StayEase home"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-6 ${light ? "bg-white/10" : "bg-forest/5"}`}>
        <MapPin size={19} className="text-coral" fill="currentColor" aria-hidden="true" />
      </span>
      <span className="font-serif text-[1.55rem] font-semibold tracking-[-0.025em]">StayEase</span>
    </Link>
  );
}

export default function AuthLayout({ title, subtitle, footer, eyebrow = "Guest account", children }) {
  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <aside
        className="relative hidden min-h-screen overflow-hidden bg-forest text-white lg:flex lg:flex-col lg:justify-between"
        style={
          HERO_IMAGE
            ? {
                backgroundImage: `linear-gradient(rgba(10,53,53,.6), rgba(10,53,53,.9)), url(${HERO_IMAGE})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,138,91,0.14),transparent_35%)]" />

        <div className="relative z-10 p-12 xl:p-16">
          <Brand light />
        </div>

        <div className="relative z-10 max-w-2xl px-12 pb-20 xl:px-16">
          <h2 className="max-w-xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] xl:text-[4.6rem]">
            Your escape
            <br />
            starts here.
          </h2>

          <p className="mt-7 max-w-md text-[15px] leading-7 text-white/65">
            A more personal way to stay. Book directly with the resort and enjoy a simple, secure reservation from arrival to departure.
          </p>

          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-sm text-white/85">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>

          <div className="mb-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">{eyebrow}</p>

            <h1 className="font-serif text-[2.45rem] leading-[1.04] tracking-[-0.035em] text-forest sm:text-[2.7rem]">{title}</h1>

            {subtitle && <p className="mt-3 max-w-md text-[14px] leading-6 text-ink/60">{subtitle}</p>}
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-[0_20px_60px_rgba(38,67,52,0.09)] sm:p-9">{children}</div>

          {footer && <p className="mt-6 text-center text-[13px] leading-6 text-ink/55">{footer}</p>}
        </div>
      </main>
    </div>
  );
}