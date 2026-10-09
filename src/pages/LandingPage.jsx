import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Check,
  Clock,
  Coffee,
  Droplets,
  Heart,
  Navigation,
  ShieldCheck,
  Star,
  Users,
  Wifi,
  Award,
} from "lucide-react";
import PageShell from "../components/PageShell";
import { Button, SectionHeading, cx } from "../components/ui";
import { useApp } from "../context/AppContext";
import { HERO_IMAGE } from "../data/rooms";
import { formatMoney } from "../lib/utils";

const HIGHLIGHTS = [
  {
    Icon: CalendarCheck,
    title: "Instant confirmation",
    text: "Book directly with the resort and get your confirmation right away.",
  },
  {
    Icon: ShieldCheck,
    title: "Free cancellation",
    text: "Cancel for free up to 48 hours before check-in.",
  },
  {
    Icon: Clock,
    title: "Easy arrivals",
    text: "Check in from 3:00 PM and check out by 11:00 AM.",
  },
];

const AMENITIES = [
  { label: "Ocean Pool", Icon: Droplets, detail: "A quiet place to unwind" },
  { label: "Forest Spa", Icon: Heart, detail: "Slow down and recharge" },
  { label: "Boutique Bistro", Icon: Coffee, detail: "Fresh meals on property" },
  { label: "High-speed Wi-Fi", Icon: Wifi, detail: "Stay connected when needed" },
  { label: "Private Parking", Icon: Navigation, detail: "Easy arrival and departure" },
  { label: "Artisanal Breakfast", Icon: Award, detail: "A thoughtful start each day" },
];

const MEMBER_PERKS = [
  "Instant booking confirmation",
  "All your reservations in one place",
  "Saved details for faster booking",
];

const CONTAINER = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10";

/** Image with a calm sand placeholder when the photo is missing or broken. */
function Photo({ src, alt, className }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cx("relative overflow-hidden bg-sand", className)}>
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
    </div>
  );
}

function Eyebrow({ children, light }) {
  return (
    <p
      className={cx(
        "mb-4 text-[10px] font-semibold uppercase tracking-[0.22em]",
        light ? "text-coral" : "text-coral"
      )}
    >
      {children}
    </p>
  );
}

export default function LandingPage() {
  const { rooms } = useApp();

  // One entry per room type (style), built from the rooms in the database.
  const roomTypes = useMemo(() => {
    const map = new Map();

    rooms.forEach((r) => {
      const t = map.get(r.style) || { style: r.style, rooms: [], image: "" };
      t.rooms.push(r);
      if (!t.image && r.image) t.image = r.image;
      map.set(r.style, t);
    });

    return [...map.values()].map((t) => ({
      ...t,
      from: Math.min(...t.rooms.map((r) => r.price)),
      maxGuests: Math.max(...t.rooms.map((r) => r.maxGuests)),
    }));
  }, [rooms]);

  // Rooms flagged popular by staff, best rated first.
  // Falls back to the top-rated rooms if none are flagged.
  const recommended = useMemo(() => {
    const byRating = [...rooms].sort((a, b) => b.rating - a.rating);
    const popular = byRating.filter((r) => r.popular);
    return (popular.length ? popular : byRating).slice(0, 3);
  }, [rooms]);

  return (
    <PageShell>
      {/* HERO */}
      <section
        id="home"
        className="relative overflow-hidden bg-forest text-white"
        style={
          HERO_IMAGE
            ? {
                backgroundImage: `linear-gradient(rgba(10,53,53,.62), rgba(10,53,53,.86)), url(${HERO_IMAGE})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,138,91,.16),transparent_30%)]"
        />

        <div className={cx(CONTAINER, "relative pb-24 pt-24 sm:pb-32 sm:pt-32")}>
          <Eyebrow>StayEase Resort · Book direct</Eyebrow>

          <h1 className="max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            Your escape
            <br />
            starts here.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
            Beautiful rooms, thoughtful amenities, and a more personal way to
            plan your stay, all through the resort itself.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button as={Link} to="/signup" size="lg" className="px-7">
              Create a free account
              <ArrowRight size={16} aria-hidden="true" />
            </Button>

            <Button
              as={Link}
              to="/login"
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/5 px-7 text-white hover:border-white/50 hover:bg-white/10"
            >
              Log in
            </Button>
          </div>

          <p className="mt-6 text-sm text-white/65">
            <a
              href="#room-types"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              Or explore our rooms first
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </p>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="scroll-mt-24 bg-white">
        <div className={cx(CONTAINER, "py-20 sm:py-24")}>
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <Eyebrow>About the resort</Eyebrow>
              <h2 className="max-w-md font-serif text-4xl leading-tight tracking-[-0.025em] text-forest sm:text-5xl">
                Book with us directly.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-ink/60">
                Pick your room, pay securely, and receive an instant
                confirmation. No middlemen and no surprises, just the resort
                and your stay.
              </p>
            </div>

            <ul className="grid gap-8 sm:grid-cols-3">
              {HIGHLIGHTS.map(({ Icon, title, text }) => (
                <li key={title}>
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-mint text-forest">
                    <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-ink/55">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ROOM TYPES */}
      <section id="room-types" className="scroll-mt-24 bg-cream">
        <div className={cx(CONTAINER, "py-20 sm:py-24")}>
          <SectionHeading
            title="Our room types"
            subtitle="From garden courtyards to sea-view suites, there is a stay for every kind of trip."
          >
            <Button as={Link} to="/rooms" variant="outline" size="sm">
              Browse all rooms
            </Button>
          </SectionHeading>

          {roomTypes.length === 0 ? (
            <p className="text-sm text-ink/60">Rooms will appear here soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {roomTypes.map((t) => (
                <article key={t.style} className="group">
                  <Photo
                    src={t.image}
                    alt={t.style}
                    className="aspect-[4/3] rounded-2xl"
                  />

                  <div className="mt-5">
                    <h3 className="font-serif text-2xl tracking-[-0.02em] text-forest">
                      {t.style}
                    </h3>

                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/55">
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble size={14} aria-hidden="true" />
                        {t.rooms.length} room{t.rooms.length !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={14} aria-hidden="true" />
                        Up to {t.maxGuests} guests
                      </span>
                    </p>

                    <p className="mt-3 text-sm leading-6 text-ink/60">
                      {t.rooms.map((r) => r.name).join(" · ")}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-forest/[0.08] pt-4">
                      <p className="text-xs text-ink/50">
                        from{" "}
                        <span className="font-serif text-xl font-semibold text-forest">
                          ₱{formatMoney(t.from)}
                        </span>{" "}
                        / night
                      </p>

                      <Link
                        to="/rooms"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral transition-all hover:gap-2.5"
                      >
                        Browse rooms
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RECOMMENDED */}
      <section id="popular" className="scroll-mt-24 bg-mint/45">
        <div className={cx(CONTAINER, "py-20 sm:py-24")}>
          <SectionHeading
            title="Guest favourites"
            subtitle="Our highest-rated rooms, loved by the people who have stayed in them."
          />

          {recommended.length === 0 ? (
            <p className="text-sm text-ink/60">
              Recommended rooms will appear here soon.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {recommended.map((r) => (
                <article key={r.id} className="group">
                  <Link
                    to={`/rooms/${r.id}`}
                    aria-label={`View ${r.name}`}
                    className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30 rounded-2xl"
                  >
                    <Photo
                      src={r.image}
                      alt={r.name}
                      className="aspect-[4/3] rounded-2xl"
                    />
                  </Link>

                  <div className="mt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {r.resort && (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
                            {r.resort}
                          </p>
                        )}
                        <h3 className="font-serif text-2xl tracking-[-0.02em] text-forest">
                          {r.name}
                        </h3>
                      </div>

                      {r.reviewCount > 0 && (
                        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink/60">
                          <Star
                            size={13}
                            className="fill-coral text-coral"
                            aria-hidden="true"
                          />
                          {r.rating} ({r.reviewCount})
                        </span>
                      )}
                    </div>

                    {(r.chips || []).length > 0 && (
                      <p className="mt-2 text-xs leading-5 text-ink/55">
                        {r.chips.join(" · ")}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-forest/[0.08] pt-4">
                      <p className="text-xs text-ink/50">
                        <span className="font-serif text-xl font-semibold text-forest">
                          ₱{formatMoney(r.price)}
                        </span>{" "}
                        / night
                      </p>

                      <Link
                        to={`/rooms/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral transition-all hover:gap-2.5"
                      >
                        View room
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* AMENITIES */}
      <section id="amenities" className="scroll-mt-24 bg-forest text-white">
        <div className={cx(CONTAINER, "py-20 sm:py-24")}>
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <Eyebrow>The StayEase experience</Eyebrow>

              <h2 className="max-w-md font-serif text-4xl leading-tight tracking-[-0.025em] sm:text-5xl">
                Everything you need.
                <br />
                Nothing you don't.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
                Thoughtful essentials and small comforts, all in one place.
                Spend less time arranging your stay and more time enjoying it.
              </p>
            </div>

            <ul className="grid border-y border-white/10 sm:grid-cols-2">
              {AMENITIES.map(({ label, Icon, detail }) => (
                <li
                  key={label}
                  className="group flex gap-4 border-b border-white/10 px-1 py-6 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                >
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

      {/* JOIN */}
      <section className="bg-cream">
        <div className={cx(CONTAINER, "py-20 sm:py-24")}>
          <div className="grid gap-10 rounded-[1.5rem] bg-white p-8 shadow-[0_20px_60px_rgba(38,67,52,0.07)] sm:p-12 lg:grid-cols-[1.2fr_auto] lg:items-center">
            <div>
              <Eyebrow>Guest account</Eyebrow>

              <h2 className="font-serif text-3xl leading-tight tracking-[-0.025em] text-forest sm:text-4xl">
                Make every stay a little easier.
              </h2>

              <p className="mt-3 max-w-lg text-sm leading-6 text-ink/60">
                Create a free account to book your stay in minutes.
              </p>

              <ul className="mt-6 space-y-2.5">
                {MEMBER_PERKS.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-center gap-3 text-sm text-ink/75"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                      <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button as={Link} to="/signup" size="lg" className="px-8">
                Create account
              </Button>
              <Button as={Link} to="/login" size="lg" variant="outline" className="px-8">
                Log in
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}