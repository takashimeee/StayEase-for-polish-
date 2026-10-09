import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  CreditCard,
  Download,
  MessageCircle,
  UtensilsCrossed,
} from "lucide-react";
import PageShell from "../components/PageShell";
import Stepper from "../components/Stepper";
import { Alert, Button, Page, cx } from "../components/ui";
import { useApp } from "../context/AppContext";
import { downloadReceipt, formatDate, formatMoney, guestsLabel } from "../lib/utils";

const NEXT_STEPS = [
  {
    icon: Clock,
    title: "Check-in from 3:00 PM",
    text: "Reception is open 24/7 if your arrival time changes.",
  },
  {
    icon: MessageCircle,
    title: "We're here to help",
    text: "Contact our team for arrival arrangements or special requests.",
  },
  {
    icon: UtensilsCrossed,
    title: "Plan your stay",
    text: "Explore our amenities and dining before you arrive.",
  },
];

function Fact({ label, children }) {
  return (
    <div>
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export default function Confirmation() {
  const { id } = useParams();
  const { myReservations } = useApp();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  const booking = myReservations.find((r) => r.id === id);

  if (!booking) return <Navigate to="/my-reservations" replace />;

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(booking.ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Couldn't copy — please select the reference manually.");
    }
  };

  const handleDownload = () => {
    downloadReceipt(booking);
    setMessage("Receipt downloaded.");
  };

  return (
    <PageShell stepper={<Stepper current={4} />}>
      <Page width="md">
        {/* Moment */}
        <div className="mx-auto max-w-2xl pb-10 pt-2 text-center">
          <span className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mint text-forest ring-[12px] ring-mint/35">
            <Check size={34} strokeWidth={2.2} aria-hidden="true" />
          </span>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-coral">
            Reservation confirmed
          </p>

          <h1 className="font-serif text-[2.65rem] leading-tight tracking-[-0.03em] text-forest sm:text-5xl">
            We'll see you soon.
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-ink/60">
            Your stay is booked. A confirmation and receipt have been sent to{" "}
            <span className="font-semibold text-ink">{booking.guest.email}</span>.
          </p>
        </div>

        {/* Reference + stay */}
        <div className="mx-auto max-w-2xl overflow-hidden rounded-[1.4rem] bg-white shadow-[0_18px_55px_rgba(38,67,52,0.08)]">
          <div className="bg-forest px-6 py-6 text-center text-white sm:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Booking reference
            </p>

            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="font-serif text-3xl tracking-[0.06em] sm:text-4xl">{booking.ref}</span>

              <button
                type="button"
                onClick={copyRef}
                aria-label="Copy booking reference"
                className="rounded-full bg-white/10 p-2.5 text-white/75 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="h-52 w-full shrink-0 overflow-hidden rounded-xl bg-sand sm:h-36 sm:w-44">
                <img
                  src={booking.image}
                  alt={booking.roomName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
                  Your accommodation
                </p>
                <h2 className="mt-1 font-serif text-2xl tracking-[-0.02em] text-forest">{booking.roomName}</h2>

                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                  <Fact label="Check in">{formatDate(booking.checkIn)}</Fact>
                  <Fact label="Check out">{formatDate(booking.checkOut)}</Fact>
                  <Fact label="Duration">
                    {booking.nights} night{booking.nights !== 1 ? "s" : ""}
                  </Fact>
                  <Fact label="Guests">{guestsLabel(booking.adults, booking.children)}</Fact>
                </dl>
                {booking.breakfastItems?.length > 0 && (
                  <div className="mt-5 border-t border-forest/10 pt-4">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Breakfast ordered</h3>
                    <ul className="mt-2 space-y-1">
                      {booking.breakfastItems.map((item) => (
                        <li key={item.itemId} className="flex justify-between gap-4 text-sm text-ink">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="shrink-0">₱{formatMoney(item.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Receipt: secondary */}
          <div className="flex flex-col gap-3 bg-cream px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/40">Total paid</span>
              <span className="font-serif text-2xl font-semibold text-forest">₱{formatMoney(booking.total)}</span>
            </div>

            <span className="inline-flex items-center gap-2 text-xs font-medium text-ink/55">
              <CreditCard size={14} aria-hidden="true" />
              {booking.paymentMethod}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => navigate("/my-reservations")} className="px-7">
            View my reservation
            <ArrowRight size={16} aria-hidden="true" />
          </Button>

          <Button size="lg" variant="outline" onClick={handleDownload} className="px-7">
            <Download size={16} aria-hidden="true" />
            Download receipt
          </Button>
        </div>

        {message && (
          <Alert tone="success" icon={false} className="mx-auto mt-4 max-w-2xl text-center">
            {message}
          </Alert>
        )}

        {/* Before you arrive */}
        <section className="mx-auto mt-16 max-w-3xl">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">Before you arrive</p>
            <h2 className="mt-2 font-serif text-2xl text-forest sm:text-3xl">A little something to look forward to</h2>
          </div>

          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {NEXT_STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="text-center sm:text-left">
                <span
                  className={cx(
                    "mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-mint text-forest",
                    "sm:mx-0"
                  )}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-ink/55">{text}</p>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-center">
            <Link
              to="/home#amenities"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral transition-all hover:gap-2.5"
            >
              Explore our amenities
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </section>
      </Page>
    </PageShell>
  );
}