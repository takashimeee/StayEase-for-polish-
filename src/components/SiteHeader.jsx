import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronDown, LogOut, MapPin, Menu, UserRound, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, cx } from "./ui";

/** Route of the logged-out LandingPage. Change if yours isn't "/". */
const LANDING = "/";
const HOME = "/home";

function buildLinks(user, pathname) {
  const base = user ? HOME : LANDING;

  return [
    { label: "Home", to: base, path: base },
    { label: "Rooms", to: "/rooms", path: "/rooms", prefixes: ["/rooms", "/booking"] },
    { label: "Menu", to: "/menu", path: "/menu" },
    { label: "Amenities", to: `${base}#amenities`, path: base, hash: "#amenities" },
    ...(user
      ? [{ label: "My Reservations", to: "/my-reservations", path: "/my-reservations", prefixes: ["/my-reservations"] }]
      : []),
    // The footer (with id="contact") is on every page, so Contact scrolls on the current page.
    { label: "Contact", to: `${pathname}#contact`, path: pathname, hash: "#contact" },
  ];
}

function isActive(link, pathname, hash) {
  if (link.hash) return pathname === link.path && hash === link.hash;
  if (link.prefixes) return link.prefixes.some((p) => pathname.startsWith(p));
  return pathname === link.path && !hash;
}

export default function SiteHeader() {
  const { user, logout } = useApp();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);

  const links = buildLinks(user, pathname);

  // Close menus on navigation, and scroll to in-page anchors.
  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);

    if (!hash) return undefined;
    const t = setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  useEffect(() => {
    if (!userOpen && !menuOpen) return undefined;

    const onClick = (e) => {
      if (userOpen && userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setUserOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen, menuOpen]);

  const initials = user?.fullName
    ?.split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    setUserOpen(false);
    navigate(LANDING);
  };

  const menuItem =
    "flex items-center gap-3 px-5 py-3 text-sm text-ink/70 transition-colors hover:bg-mint hover:text-forest focus:outline-none focus-visible:bg-mint";

  return (
    <div className="relative mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
      {/* Brand */}
      <Link
        to={user ? HOME : LANDING}
        className="group flex shrink-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/30"
        aria-label="StayEase home"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/5 transition-transform duration-300 group-hover:rotate-6">
          <MapPin size={17} className="text-coral" fill="currentColor" aria-hidden="true" />
        </span>
        <span className="font-serif text-[1.45rem] font-semibold tracking-[-0.025em] text-forest">StayEase</span>
      </Link>

      {/* Navigation */}
      <nav
        aria-label="Main"
        className={cx(
          "absolute left-0 right-0 top-full z-30 flex-col bg-white px-5 py-3 shadow-[0_20px_30px_rgba(38,67,52,0.1)]",
          "md:static md:flex md:flex-row md:items-center md:gap-1 md:bg-transparent md:p-0 md:shadow-none",
          menuOpen ? "flex" : "hidden"
        )}
      >
        {links.map((l) => {
          const active = isActive(l, pathname, hash);

          return (
            <Link
              key={l.label}
              to={l.to}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative w-full rounded-md px-3 py-3 text-sm transition-colors md:w-auto md:py-2",
                "after:absolute after:bottom-1 after:left-3 after:right-3 after:h-px after:origin-center after:scale-x-0 after:bg-coral after:transition-transform",
                "hover:text-forest hover:after:scale-x-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15",
                active ? "font-semibold text-forest after:scale-x-100" : "font-medium text-ink/60"
              )}
            >
              {l.label}
            </Link>
          );
        })}

        {!user && (
          <Link
            to="/signup"
            className="w-full rounded-md px-3 py-3 text-sm font-semibold text-coral md:hidden"
          >
            Create an account
          </Link>
        )}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Button as={Link} to="/rooms" size="sm" className="hidden lg:inline-flex">
              Book a stay
            </Button>

            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                className="group flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2.5 shadow-[0_0_0_1px_rgba(38,67,52,0.1)] transition hover:bg-mint/40 hover:shadow-[0_0_0_1px_rgba(38,67,52,0.2)] focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-xs font-semibold text-forest sm:block">
                  {user.fullName?.split(" ")[0]}
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={cx("hidden text-ink/40 transition-transform sm:block", userOpen && "rotate-180")}
                />
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_20px_45px_rgba(38,67,52,0.16)]"
                >
                  <div className="border-b border-forest/[0.08] px-5 py-4">
                    <p className="truncate text-sm font-semibold text-forest">{user.fullName}</p>
                    <p className="mt-0.5 truncate text-xs text-ink/50">{user.email}</p>
                  </div>

                  <Link to="/profile" role="menuitem" className={menuItem}>
                    <UserRound size={15} aria-hidden="true" />
                    My Profile
                  </Link>

                  <Link to="/my-reservations" role="menuitem" className={menuItem}>
                    <CalendarCheck size={15} aria-hidden="true" />
                    My Reservations
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 border-t border-forest/[0.08] px-5 py-3 text-left text-sm text-[#B3453F] transition-colors hover:bg-[#FBEAEA] focus:outline-none focus-visible:bg-[#FBEAEA]"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Button as={Link} to="/login" variant="ghost" size="sm">
              Log in
            </Button>
            <Button as={Link} to="/signup" size="sm" className="hidden sm:inline-flex">
              Sign up
            </Button>
          </>
        )}

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15 md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}