import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { addDays, todayISO } from "../lib/utils";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const PREFIX = "stayease:";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Only UI state (search + booking draft) is persisted locally now.
// Users, rooms and reservations live in the database.
function usePersisted(key, init) {
  const [value, setValue] = useState(() => load(key, typeof init === "function" ? init() : init));
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
}

// Wraps an async API call into the { ok, error, ...data } shape the pages already use.
const result = async (fn) => {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

function defaultSearch() {
  const t = todayISO();
  return { checkIn: addDays(t, 14), checkOut: addDays(t, 17), guests: "2a" };
}

export function AppProvider({ children: kids }) {
  const [boot, setBoot] = useState({ loading: true, error: "" });
  const [rooms, setRooms] = useState([]);
  const [booked, setBooked] = useState([]); // [{ id, roomId, checkIn, checkOut }]
  const [user, setUser] = useState(null);
  const [myReservations, setMyReservations] = useState([]);

  const [draft, setDraft] = usePersisted("draft", null);
  const [search, setSearch] = usePersisted("search", defaultSearch);

  // Reset a stale search (dates already in the past)
  useEffect(() => {
    if (search.checkIn < todayISO()) setSearch(defaultSearch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- initial load ---------- */
  const refreshAvailability = useCallback(async () => {
    try {
      setBooked(await api("/availability"));
    } catch {
      /* keep last known list */
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setBoot({ loading: true, error: "" });
    try {
      const [roomList, availability] = await Promise.all([api("/rooms"), api("/availability")]);
      setRooms(roomList);
      setBooked(availability);
      if (getToken()) {
        try {
          const me = await api("/auth/me");
          setUser(me.user);
          setMyReservations(await api("/reservations"));
        } catch {
          setToken(null); // expired / invalid session
        }
      }
      setBoot({ loading: false, error: "" });
    } catch {
      setBoot({ loading: false, error: "Can't reach the StayEase server. Is it running on port 4000?" });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* ---------- rooms (replaces ROOMS / findRoom from data/rooms) ---------- */
  const findRoom = useCallback((id) => rooms.find((r) => String(r.id) === String(id)), [rooms]);
  const roomStyles = useMemo(() => ["All Styles", ...new Set(rooms.map((r) => r.style))], [rooms]);

  /* ---------- availability ---------- */
  const isRoomAvailable = useCallback(
    (roomId, checkIn, checkOut, excludeId) =>
      !booked.some(
        (b) =>
          String(b.roomId) === String(roomId) &&
          String(b.id) !== String(excludeId) &&
          b.checkIn < checkOut &&
          b.checkOut > checkIn
      ),
    [booked]
  );

  /* ---------- auth ---------- */
  const startSession = async ({ token, user: u }) => {
    setToken(token);
    setUser(u);
    setMyReservations(await api("/reservations"));
    return {};
  };

  const login = (email, password) =>
    result(async () =>
      startSession(await api("/auth/login", { method: "POST", body: { email: email.trim(), password } }))
    );

  const signup = ({ fullName, email, password }) =>
    result(async () =>
      startSession(
        await api("/auth/signup", {
          method: "POST",
          body: { fullName: fullName.trim(), email: email.trim(), password },
        })
      )
    );

  // Takes the raw Google credential (ID token); the server verifies it.
  const loginWithGoogle = (credential) =>
    result(async () => startSession(await api("/auth/google", { method: "POST", body: { credential } })));

  const logout = () => {
    setToken(null);
    setUser(null);
    setMyReservations([]);
    setDraft(null);
  };

  const updateProfile = (patch) => {
    if (!user) return Promise.resolve({ ok: false, error: "Not signed in." });
    // Toggles and payment-method lists update instantly; everything else waits for the server.
    if (patch.paymentMethods || patch.preferences) setUser((u) => ({ ...u, ...patch }));
    return result(async () => {
      try {
        const data = await api("/me", { method: "PATCH", body: patch });
        setUser(data.user);
        return {};
      } catch (e) {
        const me = await api("/auth/me").catch(() => null);
        if (me) setUser(me.user); // roll back the optimistic change
        throw e;
      }
    });
  };

  const changePassword = (current, next) =>
    result(async () => {
      await api("/me/password", { method: "POST", body: { current, next } });
      return {};
    });

  /* ---------- booking draft ---------- */
  const startDraft = (roomId, { checkIn, checkOut, adults, children }) => {
    setDraft({
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      specialRequests: "",
      breakfastItems: [],
    });
  };
  const clearDraft = () => setDraft(null);

  /* ---------- reservations ---------- */
  const addReservation = ({ roomId, checkIn, checkOut, adults, children, guest, paymentMethod, breakfastItems }) =>
    result(async () => {
      if (!user) throw new Error("Please log in to complete your booking.");
      const { reservation } = await api("/reservations", {
        method: "POST",
        body: { roomId, checkIn, checkOut, adults, children, guest, paymentMethod, breakfastItems },
      });
      setMyReservations((prev) => [...prev, reservation].sort((a, b) => a.checkIn.localeCompare(b.checkIn)));
      refreshAvailability();
      return { reservation };
    });

  const modifyReservation = (id, { checkIn, checkOut, adults, children }) =>
    result(async () => {
      const oldTotal = myReservations.find((r) => r.id === id)?.total;
      const { reservation, newTotal } = await api(`/reservations/${id}`, {
        method: "PATCH",
        body: { checkIn, checkOut, adults, children },
      });
      setMyReservations((prev) => prev.map((r) => (r.id === reservation.id ? reservation : r)));
      refreshAvailability();
      return { oldTotal, newTotal };
    });

  // The server decides the refund (the second arg from the old API is no longer needed).
  const cancelReservation = (id) =>
    result(async () => {
      const { reservation, refund } = await api(`/reservations/${id}/cancel`, { method: "POST" });
      setMyReservations((prev) => prev.map((r) => (r.id === reservation.id ? reservation : r)));
      refreshAvailability();
      return { refund };
    });

  const value = {
    user,
    login,
    signup,
    loginWithGoogle,
    logout,
    updateProfile,
    changePassword,
    search,
    setSearch,
    draft,
    setDraft,
    startDraft,
    clearDraft,
    myReservations,
    addReservation,
    modifyReservation,
    cancelReservation,
    isRoomAvailable,
    rooms,
    roomStyles,
    findRoom,
  };

  if (boot.loading) {
    return <div style={{ padding: "4rem", textAlign: "center", fontFamily: "sans-serif" }}>Loading StayEase…</div>;
  }
  if (boot.error) {
    return (
      <div style={{ padding: "4rem", textAlign: "center", fontFamily: "sans-serif" }}>
        <p>{boot.error}</p>
        <button onClick={bootstrap} style={{ marginTop: 12, padding: "8px 18px" }}>
          Retry
        </button>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{kids}</AppContext.Provider>;
}

export default AppProvider;