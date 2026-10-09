import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Coffee, Star } from "lucide-react";
import PageShell from "../components/PageShell";
import { api } from "../lib/api";
import { HERO_IMAGE } from "../data/rooms";

/*
 * Breakfast menu page.
 * Breakfast options come from menu_categories + menu_items through GET /api/menu.
 *
 * It only needs PageShell, lib/api and the
 * Tailwind tokens (cream / ink / forest / coral / mint / sand), so it can be
 * copied into another copy of the project as-is.
 */

const CONTAINER = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10";
const cx = (...parts) => parts.filter(Boolean).join(" ");

const peso = (n) =>
  `₱${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: Number(n) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

// Labels for the `tags` column in menu_items
const TAG_LABELS = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  spicy: "Spicy",
  "gluten-free": "Gluten-free",
  alcohol: "Contains alcohol",
};
const tagLabel = (t) => TAG_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1);

const dishPhoto = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=320&q=80`;
const DISH_IMAGES = [
  { match: ["filipino breakfast", "longsilog", "tapsilog"], image: dishPhoto("photo-1525351484163-7529414344d8") },
  { match: ["continental breakfast"], image: dishPhoto("photo-1490645935967-10de6ba17061") },
  { match: ["healthy start bowl", "oatmeal", "yogurt", "fruit bowl"], image: dishPhoto("photo-1512621776951-a57141f2eefd") },
  { match: ["mango coconut pancakes", "pancake"], image: dishPhoto("photo-1528207776546-365bb710ee93") },
  { match: ["ube pandesal", "pandesal"], image: dishPhoto("photo-1506084868230-bb9d95c24759") },
];
const DEFAULT_DISH_IMAGE = dishPhoto("photo-1525351484163-7529414344d8");
const getDishImage = (item) => {
  if (item.image) return item.image;
  const name = item.name.toLowerCase();
  return DISH_IMAGES.find(({ match }) => match.some((term) => name.includes(term)))?.image || DEFAULT_DISH_IMAGE;
};

function Dish({ item }) {
  const [imgFailed, setImgFailed] = useState(false);
  const image = getDishImage(item);
  const showImage = !imgFailed;

  return (
    <li className={cx("flex gap-4", !item.available && "opacity-55")}>
      {showImage && (
        <img
          src={image}
          alt={item.name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-20 w-20 shrink-0 rounded-xl bg-sand object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="font-serif text-lg leading-snug text-forest">{item.name}</h3>
          <span
            aria-hidden="true"
            className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-ink/25"
          />
          <span className="shrink-0 font-serif text-lg font-semibold text-coral">{peso(item.price)}</span>
        </div>

        {item.description && <p className="mt-1 text-sm leading-6 text-ink/60">{item.description}</p>}

        {(item.signature || !item.available || item.tags.length > 0) && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {item.signature && (
              <li className="inline-flex items-center gap-1 rounded-full bg-coral/10 px-2.5 py-1 text-[10px] font-semibold text-coral">
                <Star size={10} className="fill-coral" aria-hidden="true" /> Chef's pick
              </li>
            )}
            {item.tags.map((t) => (
              <li key={t} className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-medium text-forest">
                {tagLabel(t)}
              </li>
            ))}
            {!item.available && (
              <li className="rounded-full bg-ink/10 px-2.5 py-1 text-[10px] font-semibold text-ink/60">
                Sold out today
              </li>
            )}
          </ul>
        )}

      </div>
    </li>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-[1.5rem] bg-white p-6 sm:p-10">
          <div className="mb-8 h-8 w-56 animate-pulse rounded-lg bg-sand" />
          <div className="grid gap-x-14 gap-y-8 md:grid-cols-2">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="flex gap-4">
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-sand" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-sand" />
                  <div className="h-4 w-full animate-pulse rounded bg-sand/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Menu() {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setStatus("loading");
    setError("");
    api("/menu")
      .then((data) => {
        setCategories((data.categories || []).filter((category) => category.slug === "breakfast"));
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "We couldn't load the menu.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hours = categories.filter((c) => c.hours && c.hours.toLowerCase() !== "all day");

  return (
    <PageShell>
      {/* HERO */}
      <section
        className="relative overflow-hidden bg-forest text-white"
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
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,138,91,.16),transparent_30%)]"
        />

        <div className={cx(CONTAINER, "relative py-16 sm:py-24")}>
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-coral">
            Breakfast at StayEase
          </p>

          <h1 className="max-w-2xl font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-6xl">
            A fresh start
            <br />
            to your day.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
            Browse our breakfast selection. Signed-in guests can add breakfast while booking a room and pay
            for it with their stay. Prices are in Philippine pesos.
          </p>

          {hours.length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-2 text-xs text-white/65">
              {hours.map((c) => (
                <li key={c.slug} className="flex items-center gap-1.5">
                  <Clock size={13} aria-hidden="true" />
                  {c.name.split(" & ")[0]} · {c.hours}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* MENU */}
      <main className={cx(CONTAINER, "py-12 sm:py-16")}>
        {status === "loading" && (
          <>
            <p className="sr-only" role="status">
              Loading the menu…
            </p>
            <MenuSkeleton />
          </>
        )}

        {status === "error" && (
          <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <h2 className="font-serif text-2xl text-forest">The menu isn't available</h2>
            <p className="mt-2 text-sm text-ink/65">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-6 rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && categories.length === 0 && (
          <p className="py-10 text-center text-sm text-ink/60">Our menu will appear here soon.</p>
        )}

        <div className="space-y-8 sm:space-y-10">
          {categories.map((c) => {
            return (
              <section
                key={c.slug}
                id={`menu-${c.slug}`}
                data-menu-section
                data-slug={c.slug}
                aria-labelledby={`menu-${c.slug}-title`}
                className="scroll-mt-24 rounded-[1.5rem] bg-white p-6 shadow-[0_15px_50px_rgba(38,67,52,0.07)] sm:p-10"
              >
                <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-forest/10 pb-6">
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                      <Coffee size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={`menu-${c.slug}-title`} className="font-serif text-3xl tracking-[-0.02em] text-forest">
                        {c.name}
                      </h2>
                      {c.description && <p className="mt-1 text-sm text-ink/55">{c.description}</p>}
                    </div>
                  </div>

                  {c.hours && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-ink/55">
                      <Clock size={13} aria-hidden="true" /> {c.hours}
                    </p>
                  )}
                </div>

                <ul className="grid grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-2">
                  {c.items.map((item) => <Dish key={item.id} item={item} />)}
                </ul>
              </section>
            );
          })}
        </div>

        {status === "ready" && categories.length > 0 && (
          <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-[1.5rem] bg-mint/60 p-8 text-center sm:flex-row sm:p-10 sm:text-left">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">Add breakfast</p>
              <h2 className="mt-2 font-serif text-2xl text-forest sm:text-3xl">Enjoy breakfast with your stay.</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink/60">
                Choose breakfast while booking a room. The cost is included in your room checkout.
              </p>
            </div>
            <Link
              to="/rooms"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-coral px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
            >
              Browse rooms <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </main>
    </PageShell>
  );
}