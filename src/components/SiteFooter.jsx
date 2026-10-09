import { Link } from "react-router-dom";
import { Camera, MapPin, MessageCircle, Share2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { RESORT } from "../lib/resort";

const SOCIALS = [
  { key: "instagram", Icon: Camera, label: "Instagram" },
  { key: "facebook", Icon: Share2, label: "Facebook" },
  { key: "maps", Icon: MapPin, label: "Find us on Maps" },
  { key: "messenger", Icon: MessageCircle, label: "Message us" },
];

function Heading({ children }) {
  return (
    <h2 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
      {children}
    </h2>
  );
}

const linkCls =
  "text-white/60 transition-colors hover:text-white focus:outline-none focus-visible:text-white focus-visible:underline";

export default function SiteFooter() {
  const { user } = useApp();

  const explore = [
    { label: "Rooms", to: "/rooms" },
    { label: "Amenities", to: user ? "/home#amenities" : "/#amenities" },
    ...(user
      ? [
          { label: "My Reservations", to: "/my-reservations" },
          { label: "My Profile", to: "/profile" },
        ]
      : [
          { label: "Log in", to: "/login" },
          { label: "Create an account", to: "/signup" },
        ]),
  ];

  const socials = SOCIALS.filter((s) => RESORT.social[s.key]);
  const hasContact = RESORT.address || RESORT.phone || RESORT.email;

  return (
    <footer className="scroll-mt-24 bg-forest-dark text-white/60" id="contact">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-serif text-2xl font-semibold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07]">
                <MapPin size={16} className="text-coral" fill="currentColor" aria-hidden="true" />
              </span>
              {RESORT.name}
            </div>

            <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">{RESORT.tagline}</p>

            {socials.length > 0 && (
              <div className="mt-6 flex gap-2">
                {socials.map(({ key, Icon, label }) => (
                  <a
                    key={key}
                    href={RESORT.social[key]}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-all hover:border-coral/40 hover:bg-coral hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
                  >
                    <Icon size={15} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label="Footer">
            <Heading>Explore</Heading>
            <ul className="space-y-3 text-sm">
              {explore.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className={linkCls}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {hasContact && (
            <div>
              <Heading>Visit &amp; contact</Heading>
              <address className="space-y-3 text-sm not-italic leading-6">
                {RESORT.address && <p>{RESORT.address}</p>}
                {RESORT.phone && (
                  <p>
                    <a href={`tel:${RESORT.phone.replace(/\s/g, "")}`} className={linkCls}>
                      {RESORT.phone}
                    </a>
                  </p>
                )}
                {RESORT.email && (
                  <p>
                    <a href={`mailto:${RESORT.email}`} className={linkCls}>
                      {RESORT.email}
                    </a>
                  </p>
                )}
                <p className="text-white/45">
                  Check-in from {RESORT.checkIn} · Check-out by {RESORT.checkOut}
                </p>
              </address>
            </div>
          )}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-[11px] text-white/40 sm:flex-row">
          <span>© 2026 {RESORT.fullName}. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/privacy" className={linkCls}>Privacy Policy</Link>
            <Link to="/terms" className={linkCls}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}