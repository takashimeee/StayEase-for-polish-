import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import RoomCard from "./RoomCard";
import { SectionHeading } from "./ui";

const API = "http://localhost:4000";
const CONTAINER = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10";

export default function TopRatedRooms({ getStatus, onBook, limit = 3, contained = true }) {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/rooms/recommended`)
      .then((res) => res.json())
      .then((data) => setRooms(Array.isArray(data) ? data.slice(0, limit) : []))
      .catch(console.error);
  }, [limit]);

  if (rooms.length === 0) return null;

  return (
    <section className={contained ? `${CONTAINER} pt-20 sm:pt-24` : "mb-14"}>
      <SectionHeading
        title="Top rated by guests"
        subtitle="Ranked by what guests actually wrote in their reviews, analyzed with AI."
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <div key={room.id}>
            <RoomCard
              room={room}
              status={getStatus ? getStatus(room) : { bookable: true, reason: "" }}
              onBook={() => onBook?.(room)}
            />
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink/60">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
              <span>
                {room.aiSummary} <strong className="text-forest">{room.aiScore.toFixed(1)}/10</strong>
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}