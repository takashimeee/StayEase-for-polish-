import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Alert, Button, textareaCls } from "./ui";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { getGuestOption } from "../data/rooms";
import { formatMoney, nightsBetween, stayIssue } from "../lib/utils";

const IDEAS = [
  "A quiet romantic getaway with a sea view",
  "Family trip with two kids, close to the pool",
  "Budget-friendly room for a short work-from-beach stay",
];

export default function RoomConcierge() {
  const { search, findRoom, isRoomAvailable, startDraft } = useApp();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const guest = getGuestOption(search.guests);
  const nights = nightsBetween(search.checkIn, search.checkOut);

  const ask = async (e) => {
    e?.preventDefault();
    if (loading) return;

    if (text.trim().length < 5) {
      setError("Tell us a little about your trip first.");
      return;
    }
    if (nights <= 0) {
      setError("Choose valid dates above first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api("/recommendations", {
        method: "POST",
        body: {
          prompt: text.trim(),
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          adults: guest.adults,
          children: guest.children,
        },
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message || "We couldn't load recommendations right now.");
    } finally {
      setLoading(false);
    }
  };

  const reserve = (room) => {
    startDraft(room.id, {
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: guest.adults,
      children: guest.children,
    });
    navigate("/booking");
  };

  // Re-check on the client so a stale result can never offer a room that is now booked.
  const picks = (result?.picks || [])
    .map((p) => ({ ...p, room: findRoom(p.roomId) }))
    .filter((p) => p.room);

  return (
    <section aria-labelledby="concierge-title" className="mb-12 rounded-2xl bg-mint/50 p-5 sm:p-8">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 id="concierge-title" className="font-serif text-2xl text-forest">
            Not sure which room?
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Tell us about your trip and we'll suggest the best fit for your dates.
          </p>
        </div>
      </div>

      <form onSubmit={ask}>
        <label htmlFor="concierge-text" className="sr-only">
          Describe your trip
        </label>
        <textarea
          id="concierge-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          maxLength={500}
          rows={3}
          placeholder="e.g. We're celebrating our anniversary and want somewhere quiet with a sea view."
          className={textareaCls}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setText(idea)}
              className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-ink/65 transition hover:text-forest focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15"
            >
              {idea}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button type="submit" loading={loading}>
            {loading ? "Finding your room…" : "Suggest rooms"}
          </Button>
          <p className="text-xs text-ink/50">
            Based on your dates and guests above. Suggestions are AI-generated.
          </p>
        </div>
      </form>

      <div aria-live="polite">
        {error && (
          <Alert tone="error" className="mt-5">
            {error}
          </Alert>
        )}

        {result && !error && (
          <div className="mt-8">
            {result.summary && <p className="mb-5 text-sm font-medium text-forest">{result.summary}</p>}

            {picks.length === 0 ? (
              <p className="text-sm text-ink/60">
                Try different dates or fewer guests, or{" "}
                <Link to="/rooms" className="font-semibold text-coral transition-colors hover:text-coral-dark">
                  browse all rooms
                </Link>
                .
              </p>
            ) : (
              <ol className="space-y-4">
                {picks.map(({ room, reason }, i) => {
                  const issue = stayIssue({
                    room,
                    checkIn: search.checkIn,
                    checkOut: search.checkOut,
                    adults: guest.adults,
                    children: guest.children,
                    available: isRoomAvailable(room.id, search.checkIn, search.checkOut),
                  });

                  return (
                    <li
                      key={room.id}
                      className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-sand sm:h-28 sm:w-40">
                        {room.image && <img src={room.image} alt={room.name} className="h-full w-full object-cover" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
                          {i === 0 ? "Best match" : `Option ${i + 1}`}
                        </p>
                        <h3 className="font-serif text-xl text-forest">{room.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-ink/65">{reason}</p>
                        <p className="mt-2 text-xs text-ink/50">
                          <span className="font-serif text-base font-semibold text-forest">
                            ₱{formatMoney(room.price)}
                          </span>{" "}
                          / night
                        </p>
                        {issue && <p className="mt-1 text-xs text-red-600">{issue}</p>}
                      </div>

                      <div className="flex gap-2 sm:flex-col">
                        <Button size="sm" onClick={() => reserve(room)} disabled={Boolean(issue)}>
                          Reserve <ArrowRight size={14} aria-hidden="true" />
                        </Button>
                        <Button as={Link} to={`/rooms/${room.id}`} size="sm" variant="outline">
                          View room
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}