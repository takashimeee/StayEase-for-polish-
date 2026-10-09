import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { pool } from "./db.js";
import createRecommendations from "./routes/recommendations.js";
import createMenuRoutes from "./routes/menu.js";

import cron from "node-cron";
import { createRoomRanking } from "./services/roomRanking.js";

import { fileURLToPath } from "node:url";
import createAdminRoutes from "./routes/admin.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "15mb" }));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const FEE_RATE = Number(process.env.FEE_RATE ?? 0.12);
const SERVICE_RATE = Number(process.env.SERVICE_RATE ?? 0.05);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PREFS = { email: true, sms: false, newsletter: false };

/* ------------------------------ helpers ------------------------------ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Server is the source of truth for money. Keep in sync with calcPricing() in the frontend.
const pricing = (price, nights) => {
  const subtotal = round2(price * nights);
  const fees = round2(subtotal * FEE_RATE);
  const service = round2(subtotal * SERVICE_RATE);
  return { subtotal, fees, service, total: round2(subtotal + fees + service) };
};

const splitName = (full) => {
  const [first = "", ...rest] = String(full).trim().split(/\s+/);
  return { first: first.slice(0, 80), last: rest.join(" ").slice(0, 80) };
};

const sign = (id) => jwt.sign({ sub: id }, JWT_SECRET, { expiresIn: "7d" });
const auth = (req, _res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  try {
    req.userId = Number(jwt.verify(token, JWT_SECRET).sub);
    next();
  } catch {
    next(new HttpError(401, "Please log in to continue."));
  }
};
app.use("/api/menu", createMenuRoutes(pool));

async function loadUser(id) {
  const [[u]] = await pool.query("SELECT * FROM users WHERE user_id=? AND is_active=1", [id]);
  if (!u) return null;
  const [pm] = await pool.query(
    "SELECT method_id, label, is_default FROM saved_payment_methods WHERE user_id=? ORDER BY method_id",
    [id]
  );
  const prefs = typeof u.preferences === "string" ? JSON.parse(u.preferences) : u.preferences || {};
  return {
    id: u.user_id,
    role: u.role,
    fullName: `${u.first_name} ${u.last_name}`.trim(),
    email: u.email,
    phone: u.phone || "",
    birthday: u.birthday || "",
    address: u.address || "",
    memberSince: new Date(u.created_at.replace(" ", "T")).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    preferences: { ...DEFAULT_PREFS, ...prefs },
    paymentMethods: pm.map((m) => ({ id: String(m.method_id), label: m.label, isDefault: !!m.is_default })),
  };
}

/* ------------------------------ auth ------------------------------ */

app.post(
  "/api/auth/signup",
  h(async (req, res) => {
    const { fullName = "", email = "", password = "" } = req.body;
    if (!fullName.trim()) throw new HttpError(400, "Enter your full name.");
    if (!EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address.");
    if (password.length < 8) throw new HttpError(400, "Use at least 8 characters.");
    const mail = email.toLowerCase();
    const [[dup]] = await pool.query("SELECT user_id FROM users WHERE email=?", [mail]);
    if (dup) throw new HttpError(409, "An account with this email already exists.");
    const { first, last } = splitName(fullName);
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      "INSERT INTO users (first_name,last_name,email,password_hash) VALUES (?,?,?,?)",
      [first, last, mail, hash]
    );
    res.status(201).json({ token: sign(r.insertId), user: await loadUser(r.insertId) });
  })
);

app.post(
  "/api/auth/login",
  h(async (req, res) => {
    const { email = "", password = "" } = req.body;
    const [[u]] = await pool.query("SELECT user_id, password_hash FROM users WHERE email=? AND is_active=1", [
      email.toLowerCase(),
    ]);
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      throw new HttpError(401, "Incorrect email or password.");
    }
    res.json({ token: sign(u.user_id), user: await loadUser(u.user_id) });
  })
);

// Verifies the Google ID token on the server (never trust the client-decoded one).
app.post(
  "/api/auth/google",
  h(async (req, res) => {
    const ticket = await googleClient
      .verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })
      .catch(() => null);
    const p = ticket?.getPayload();
    if (!p?.email || !p.email_verified) throw new HttpError(401, "Your Google email isn't verified.");
    const mail = p.email.toLowerCase();
    const [[existing]] = await pool.query("SELECT user_id FROM users WHERE email=?", [mail]);
    let id = existing?.user_id;
    if (!id) {
      const { first, last } = splitName(p.name || mail.split("@")[0]);
      const hash = await bcrypt.hash(randomUUID(), 10); // random: Google users don't use a password
      const [r] = await pool.query(
        "INSERT INTO users (first_name,last_name,email,password_hash) VALUES (?,?,?,?)",
        [first, last, mail, hash]
      );
      id = r.insertId;
    }
    res.json({ token: sign(id), user: await loadUser(id) });
  })
);

app.get(
  "/api/auth/me",
  auth,
  h(async (req, res) => {
    const user = await loadUser(req.userId);
    if (!user) throw new HttpError(401, "Please log in to continue.");
    res.json({ user });
  })
);

/* ------------------------------ profile ------------------------------ */

app.patch(
  "/api/me",
  auth,
  h(async (req, res) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const sets = [];
      const vals = [];
      if (b.fullName !== undefined) {
        if (!String(b.fullName).trim()) throw new HttpError(400, "Enter your full name.");
        const n = splitName(b.fullName);
        sets.push("first_name=?", "last_name=?");
        vals.push(n.first, n.last);
      }
      if (b.email !== undefined) {
        if (!EMAIL.test(b.email)) throw new HttpError(400, "Enter a valid email address.");
        const mail = b.email.toLowerCase();
        const [[dup]] = await conn.query("SELECT user_id FROM users WHERE email=? AND user_id<>?", [
          mail,
          req.userId,
        ]);
        if (dup) throw new HttpError(409, "That email is already in use.");
        sets.push("email=?");
        vals.push(mail);
      }
      if (b.phone !== undefined) (sets.push("phone=?"), vals.push(String(b.phone || "").slice(0, 20) || null));
      if (b.birthday !== undefined) (sets.push("birthday=?"), vals.push(b.birthday || null));
      if (b.address !== undefined) (sets.push("address=?"), vals.push(String(b.address || "").slice(0, 255) || null));
      if (b.preferences !== undefined) (sets.push("preferences=?"), vals.push(JSON.stringify(b.preferences)));
      if (sets.length) {
        await conn.query(`UPDATE users SET ${sets.join(", ")} WHERE user_id=?`, [...vals, req.userId]);
      }
      if (Array.isArray(b.paymentMethods)) {
        await conn.query("DELETE FROM saved_payment_methods WHERE user_id=?", [req.userId]);
        for (const m of b.paymentMethods) {
          await conn.query("INSERT INTO saved_payment_methods (user_id,label,is_default) VALUES (?,?,?)", [
            req.userId,
            String(m.label).slice(0, 80),
            m.isDefault ? 1 : 0,
          ]);
        }
      }
      await conn.commit();
      res.json({ user: await loadUser(req.userId) });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.post(
  "/api/me/password",
  auth,
  h(async (req, res) => {
    const { current = "", next = "" } = req.body;
    if (next.length < 8) throw new HttpError(400, "New password must be at least 8 characters.");
    const [[u]] = await pool.query("SELECT password_hash FROM users WHERE user_id=?", [req.userId]);
    if (!(await bcrypt.compare(current, u.password_hash))) {
      throw new HttpError(400, "Current password is incorrect.");
    }
    await pool.query("UPDATE users SET password_hash=? WHERE user_id=?", [await bcrypt.hash(next, 10), req.userId]);
    res.json({});
  })
);

/* ------------------------------ rooms ------------------------------ */

async function loadRooms(onlyId) {
  const where = onlyId ? "AND r.room_id=?" : "";
  const [rooms] = await pool.query(
    `SELECT r.*,
       (SELECT ROUND(AVG(rv.rating),1) FROM reviews rv JOIN reservations x ON x.reservation_id=rv.reservation_id
         WHERE x.room_id=r.room_id) AS rating,
       (SELECT COUNT(*) FROM reviews rv JOIN reservations x ON x.reservation_id=rv.reservation_id
         WHERE x.room_id=r.room_id) AS review_count,
       (SELECT COUNT(*) FROM room_units ux WHERE ux.room_id=r.room_id AND ux.is_active=1) AS unit_count
     FROM rooms r WHERE r.is_active=1 ${where}
       AND EXISTS (SELECT 1 FROM room_units ux WHERE ux.room_id=r.room_id AND ux.is_active=1)
     ORDER BY r.room_id`,
    onlyId ? [onlyId] : []
  );
  const [images] = await pool.query(
    "SELECT room_id, image_url FROM room_images ORDER BY room_id, is_primary DESC, sort_order, image_id"
  );
  const [amen] = await pool.query(
    `SELECT ra.room_id, a.name, a.icon FROM room_amenities ra
     JOIN amenities a ON a.amenity_id=ra.amenity_id ORDER BY ra.room_id, a.amenity_id`
  );
  return rooms.map((r) => {
    const gallery = images.filter((i) => i.room_id === r.room_id).map((i) => i.image_url);
    const am = amen.filter((a) => a.room_id === r.room_id);
    return {
      id: r.room_id,
      name: r.room_name,
      style: r.room_type,
      resort: r.resort || "",
      price: Number(r.base_price),
      maxGuests: r.max_capacity,
      minNights: r.min_stay_nights,
      popular: !!r.is_popular,
      totalRooms: Number(r.unit_count || 0), // how many physical rooms of this type exist
      beds: r.beds || "",
      sqm: r.sqm || 0,
      view: r.view_label || "",
      location: r.location || "",
      rating: Number(r.rating || 0),
      reviewCount: Number(r.review_count || 0),
      about: (r.description || "").split(/\n\s*\n/).filter(Boolean),
      image: gallery[0] || "",
      gallery,
      chips: am.slice(0, 3).map((a) => a.name),
      amenities: am.map((a) => a.icon).filter(Boolean),
    };
  });
}

app.get("/api/rooms", h(async (_req, res) => res.json(await loadRooms())));

app.get(
  "/api/rooms/recommended",
  h(async (_req, res) => {
    const [scores] = await pool.query(
      `SELECT room_id, ai_sentiment_score, ai_summary FROM rooms
       WHERE is_active=1 AND ai_sentiment_score IS NOT NULL
       ORDER BY ai_sentiment_score DESC LIMIT 6`
    );
    const byId = new Map((await loadRooms()).map((r) => [r.id, r]));
    res.json(
      scores
        .filter((s) => byId.has(s.room_id))
        .map((s) => ({
          ...byId.get(s.room_id),
          aiScore: Number(s.ai_sentiment_score),
          aiSummary: s.ai_summary || "",
        }))
    );
  })
);

app.get(
  "/api/rooms/:id/reviews",
  h(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT rv.rating, rv.comment, rv.created_at, u.first_name, u.last_name,
              DATEDIFF(x.check_out_date, x.check_in_date) AS nights
       FROM reviews rv
       JOIN reservations x ON x.reservation_id=rv.reservation_id
       JOIN users u ON u.user_id=rv.guest_id
       WHERE x.room_id=? ORDER BY rv.created_at DESC`,
      [req.params.id]
    );
    res.json(
      rows.map((r) => ({
        author: `${r.first_name} ${r.last_name.charAt(0)}${r.last_name ? "." : ""}`.trim(),
        rating: r.rating,
        text: r.comment || "",
        date: new Date(r.created_at.replace(" ", "T")).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        meta: `Stayed ${r.nights} night${r.nights !== 1 ? "s" : ""}`,
      }))
    );
  })
);

// Blocked date ranges per room type, so the UI can check availability instantly.
// A range is only "blocked" while EVERY active room of that type is booked, so the
// frontend's "does it overlap a blocked range?" check keeps working for multi-room types.
app.get(
  "/api/availability",
  h(async (_req, res) => {
    const [caps] = await pool.query(
      "SELECT room_id, COUNT(*) AS n FROM room_units WHERE is_active=1 GROUP BY room_id"
    );
    const capacity = new Map(caps.map((c) => [c.room_id, Number(c.n)]));
    const [rows] = await pool.query(
      `SELECT reservation_id, room_id, check_in_date, check_out_date FROM reservations
       WHERE status IN ('pending_payment','confirmed') AND check_out_date >= ?`,
      [todayISO()]
    );

    const byRoom = new Map();
    for (const r of rows) {
      if (!byRoom.has(r.room_id)) byRoom.set(r.room_id, []);
      byRoom.get(r.room_id).push(r);
    }

    const blocked = [];
    for (const [roomId, list] of byRoom) {
      const cap = capacity.get(roomId) || 0;
      // Sweep through the dates: +1 on check-in, -1 on check-out (check-out frees the room that day).
      const events = [];
      for (const r of list) {
        events.push({ date: r.check_in_date, delta: 1 });
        events.push({ date: r.check_out_date, delta: -1 });
      }
      events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.delta - b.delta));

      let count = 0;
      let from = null;
      for (const ev of events) {
        count += ev.delta;
        if (cap === 0 || count >= cap) {
          if (from === null) from = ev.date;
        } else if (from !== null) {
          if (ev.date > from) {
            blocked.push({
              id: `${roomId}:${from}`,
              roomId,
              checkIn: from,
              checkOut: ev.date,
              reservationIds: list
                .filter((r) => r.check_in_date < ev.date && r.check_out_date > from)
                .map((r) => String(r.reservation_id)),
            });
          }
          from = null;
        }
      }
    }
    res.json(blocked);
  })
);

/* ------------------------------ reservations ------------------------------ */

const RES_SQL = `
  SELECT res.*, rm.room_name, rm.base_price,
    (SELECT image_url FROM room_images WHERE room_id=rm.room_id ORDER BY is_primary DESC, sort_order LIMIT 1) AS image
  FROM reservations res JOIN rooms rm ON rm.room_id=res.room_id`;

const mapRes = (r) => ({
  id: String(r.reservation_id),
  ref: r.reference_code,
  roomId: r.room_id,
  roomName: r.room_name,
  image: r.image || "",
  checkIn: r.check_in_date,
  checkOut: r.check_out_date,
  nights: nightsBetween(r.check_in_date, r.check_out_date),
  adults: r.adults,
  children: r.children,
  guest: {
    fullName: r.guest_name || "",
    email: r.guest_email || "",
    phone: r.guest_phone || "",
    specialRequests: r.special_requests || "",
  },
  subtotal: Number(r.room_subtotal),
  fees: Number(r.fees_amount),
  service: Number(r.service_fee_amount),
  breakfastSubtotal: Number(r.breakfast_subtotal || 0),
  total: Number(r.total_amount),
  paymentMethod: r.payment_method || "",
  refund: Number(r.refund_amount),
  status: r.status === "cancelled" ? "cancelled" : "confirmed",
  cancelled: r.status === "cancelled",
});

function stayProblem(room, { checkIn, checkOut, adults, children }) {
  if (!DATE.test(checkIn || "") || !DATE.test(checkOut || "")) return "Pick valid dates.";
  const nights = nightsBetween(checkIn, checkOut);
  if (!(nights > 0)) return "Check-out must be after check-in.";
  if (checkIn < todayISO()) return "Check-in can't be in the past.";
  if (nights < room.min_stay_nights) return `${room.room_name} requires a ${room.min_stay_nights}-night minimum stay.`;
  if (adults < 1) return "At least one adult is required.";
  if (adults + children > room.max_capacity) return `This room fits up to ${room.max_capacity} guests.`;
  return null;
}

// A room TYPE (rooms row) has many physical rooms (room_units rows). A booking claims one
// specific room, and a type only counts as full when every active room is taken.
// Returns a free unit_id, or null. preferUnitId keeps a guest in their current room on modify.
// Call it while holding the rooms row lock (FOR UPDATE) so two bookings can't claim the same room.
async function findFreeUnit(conn, roomId, checkIn, checkOut, excludeReservationId = 0, preferUnitId = 0) {
  const [rows] = await conn.query(
    `SELECT u.unit_id FROM room_units u
     WHERE u.room_id=? AND u.is_active=1
       AND NOT EXISTS (
         SELECT 1 FROM reservations r
         WHERE r.unit_id=u.unit_id AND r.status IN ('pending_payment','confirmed')
           AND r.check_in_date < ? AND r.check_out_date > ? AND r.reservation_id <> ?)
     ORDER BY (u.unit_id = ?) DESC, u.unit_id LIMIT 1`,
    [roomId, checkOut, checkIn, excludeReservationId, preferUnitId]
  );
  return rows.length ? rows[0].unit_id : null;
}

const isFree = async (conn, roomId, checkIn, checkOut, excludeId = 0) =>
  (await findFreeUnit(conn, roomId, checkIn, checkOut, excludeId)) !== null;

// Cancellation rule: free until 48h before 3 PM check-in, otherwise one night + fees is kept.
// Mirror cancellationOutcome() in the frontend utils. (Schema comments describe a 100/50/0 tier
// policy - if you prefer that one, change ONLY this function.)
function cancellationOutcome(row) {
  const total = Number(row.total_amount);
  const hours = (new Date(`${row.check_in_date}T15:00:00`) - Date.now()) / 36e5;
  if (hours >= 48) return { free: true, charge: 0, refund: total };
  const charge = Math.min(total, round2(Number(row.base_price) * (1 + FEE_RATE)));
  return { free: false, charge, refund: round2(total - charge) };
}

const notify = (conn, userId, type, message) =>
  conn.query("INSERT INTO notifications (user_id,type,message) VALUES (?,?,?)", [userId, type, message]);

let breakfastSchemaPromise;
const ensureBreakfastSchema = () => {
  if (!breakfastSchemaPromise) {
    breakfastSchemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS reservation_menu_items (
      reservation_menu_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      reservation_id BIGINT UNSIGNED NOT NULL,
      menu_item_id BIGINT UNSIGNED NOT NULL,
      item_name VARCHAR(160) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      line_total DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (reservation_menu_item_id),
      KEY idx_reservation_menu_items_reservation (reservation_id)
    ) ENGINE=InnoDB`).catch((err) => {
      breakfastSchemaPromise = null;
      throw err;
    });
  }
  return breakfastSchemaPromise;
};

async function withBreakfastItems(reservations) {
  if (reservations.length === 0) return [];
  await ensureBreakfastSchema();
  const ids = reservations.map((reservation) => reservation.reservation_id);
  const [rows] = await pool.query(
    `SELECT reservation_id, menu_item_id, item_name, unit_price, quantity, line_total
     FROM reservation_menu_items
     WHERE reservation_id IN (${ids.map(() => "?").join(",")})
     ORDER BY reservation_menu_item_id`,
    ids
  );
  const byReservation = new Map();
  for (const row of rows) {
    const key = String(row.reservation_id);
    const items = byReservation.get(key) || [];
    items.push({
      itemId: row.menu_item_id,
      name: row.item_name,
      unitPrice: Number(row.unit_price),
      quantity: Number(row.quantity),
      lineTotal: Number(row.line_total),
    });
    byReservation.set(key, items);
  }
  return reservations.map((reservation) => ({
    ...mapRes(reservation),
    breakfastItems: byReservation.get(String(reservation.reservation_id)) || [],
  }));
}

app.get(
  "/api/reservations",
  auth,
  h(async (req, res) => {
    const [rows] = await pool.query(`${RES_SQL} WHERE res.guest_id=? ORDER BY res.created_at DESC`, [req.userId]);
    res.json(await withBreakfastItems(rows));
  })
);

app.post(
  "/api/reservations",
  auth,
  h(async (req, res) => {
    const { roomId, checkIn, checkOut, guest = {}, paymentMethod = "GCash" } = req.body;
    const requestedBreakfast = req.body.breakfastItems ?? [];
    if (!Array.isArray(requestedBreakfast) || requestedBreakfast.length > 30) {
      throw new HttpError(400, "Choose up to 30 breakfast items.");
    }
    const breakfastQuantities = new Map();
    for (const entry of requestedBreakfast) {
      const itemId = Number(entry?.itemId);
      const quantity = Number(entry?.quantity);
      if (!Number.isSafeInteger(itemId) || itemId < 1 || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new HttpError(400, "Each breakfast item needs a valid item ID and quantity.");
      }
      const combined = (breakfastQuantities.get(itemId) || 0) + quantity;
      if (combined > 20) throw new HttpError(400, "You can order up to 20 of each breakfast item.");
      breakfastQuantities.set(itemId, combined);
    }
    if (breakfastQuantities.size > 0) await ensureBreakfastSchema();

    const adults = Number(req.body.adults) || 0;
    const children = Number(req.body.children) || 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Lock the room row so two people can't book the same dates at once.
      const [[room]] = await conn.query("SELECT * FROM rooms WHERE room_id=? AND is_active=1 FOR UPDATE", [roomId]);
      if (!room) throw new HttpError(404, "Room not found.");
      const problem = stayProblem(room, { checkIn, checkOut, adults, children });
      if (problem) throw new HttpError(400, problem);
      // Claim one specific free room of this type (the rooms row is locked above).
      const unitId = await findFreeUnit(conn, room.room_id, checkIn, checkOut);
      if (!unitId) {
        throw new HttpError(409, "Sorry, those dates were just booked. Please choose different dates.");
      }
      const nights = nightsBetween(checkIn, checkOut);
      const p = pricing(Number(room.base_price), nights);
      let breakfastLines = [];
      let breakfastTotal = 0;
      if (breakfastQuantities.size > 0) {
        const itemIds = [...breakfastQuantities.keys()];
        const [items] = await conn.query(
          `SELECT mi.item_id, mi.name, mi.price, mi.is_active, mi.is_available
           FROM menu_items mi
           JOIN menu_categories mc ON mc.category_id=mi.category_id
           WHERE mc.slug='breakfast' AND mc.is_active=1
             AND mi.item_id IN (${itemIds.map(() => "?").join(",")})
           FOR UPDATE`,
          itemIds
        );
        if (items.length !== itemIds.length || items.some((item) => Number(item.is_active) !== 1)) {
          throw new HttpError(404, "One or more selected breakfast items are no longer available.");
        }
        if (items.some((item) => Number(item.is_available) !== 1)) {
          throw new HttpError(409, "One or more selected breakfast items are sold out.");
        }
        breakfastLines = items.map((item) => {
          const unitPrice = Number(item.price);
          const quantity = breakfastQuantities.get(Number(item.item_id));
          return {
            itemId: item.item_id,
            name: item.name,
            unitPrice,
            quantity,
            lineTotal: round2(unitPrice * quantity),
          };
        });
        breakfastTotal = round2(breakfastLines.reduce((sum, item) => sum + item.lineTotal, 0));
      }
      const total = round2(p.total + breakfastTotal);
      const ref = `SE-${randomBytes(4).toString("hex").toUpperCase()}`;

      const [r] = await conn.query(
        `INSERT INTO reservations
          (reference_code, guest_id, room_id, unit_id, check_in_date, check_out_date, num_guests, adults, children,
           room_subtotal, fees_amount, service_fee_amount, breakfast_subtotal, total_amount, status,
           guest_name, guest_email, guest_phone, special_requests, payment_method)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'confirmed', ?,?,?,?,?)`,
        [ref, req.userId, room.room_id, unitId, checkIn, checkOut, adults + children, adults, children,
         p.subtotal, p.fees, p.service, breakfastTotal, total,
         String(guest.fullName || "").slice(0, 160), String(guest.email || "").slice(0, 150),
         String(guest.phone || "").slice(0, 30), guest.specialRequests || null,
         String(paymentMethod).slice(0, 80)]
      );

      for (const item of breakfastLines) {
        await conn.query(
          `INSERT INTO reservation_menu_items
           (reservation_id, menu_item_id, item_name, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [r.insertId, item.itemId, item.name, item.unitPrice, item.quantity, item.lineTotal]
        );
      }

      // MOCK payment: no gateway call, just record it as paid.
      const type = /^card/i.test(paymentMethod) ? "card" : /maya/i.test(paymentMethod) ? "maya" : "gcash";
      await conn.query(
        `INSERT INTO payments (reservation_id, amount, provider, provider_reference, status, paid_at)
         VALUES (?,?,?,?, 'paid', NOW())`,
        [r.insertId, total, `mock_${type}`, `MOCK-${ref}`]
      );
      await notify(conn, req.userId, "booking_confirmation", `Booking ${ref} confirmed for ${room.room_name}.`);
      await conn.commit();

      const [[row]] = await pool.query(`${RES_SQL} WHERE res.reservation_id=?`, [r.insertId]);
      const [reservation] = await withBreakfastItems([row]);
      res.status(201).json({ reservation });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.patch(
  "/api/reservations/:id",
  auth,
  h(async (req, res) => {
    const { checkIn, checkOut } = req.body;
    const adults = Number(req.body.adults) || 0;
    const children = Number(req.body.children) || 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[cur]] = await conn.query(
        "SELECT * FROM reservations WHERE reservation_id=? AND guest_id=? FOR UPDATE",
        [req.params.id, req.userId]
      );
      if (!cur) throw new HttpError(404, "Reservation not found.");
      if (cur.status !== "confirmed" || cur.check_out_date < todayISO()) {
        throw new HttpError(400, "This reservation can no longer be changed.");
      }
      const [[room]] = await conn.query("SELECT * FROM rooms WHERE room_id=? FOR UPDATE", [cur.room_id]);
      const problem = stayProblem(room, { checkIn, checkOut, adults, children });
      if (problem) throw new HttpError(400, problem);
      // Stay in the same room if it's free for the new dates, otherwise move to another free one.
      const unitId = await findFreeUnit(conn, room.room_id, checkIn, checkOut, cur.reservation_id, cur.unit_id || 0);
      if (!unitId) {
        throw new HttpError(409, "Those dates aren't available for this room.");
      }
      const p = pricing(Number(room.base_price), nightsBetween(checkIn, checkOut));
      const breakfastSubtotal = Number(cur.breakfast_subtotal || 0);
      const updatedTotal = round2(p.total + breakfastSubtotal);
      await conn.query(
        `UPDATE reservations SET check_in_date=?, check_out_date=?, num_guests=?, adults=?, children=?,
           room_subtotal=?, fees_amount=?, service_fee_amount=?, total_amount=?, unit_id=? WHERE reservation_id=?`,
        [checkIn, checkOut, adults + children, adults, children, p.subtotal, p.fees, p.service, updatedTotal, unitId, cur.reservation_id]
      );
      await conn.query("UPDATE payments SET amount=? WHERE reservation_id=?", [updatedTotal, cur.reservation_id]);
      await conn.commit();
      const [[row]] = await pool.query(`${RES_SQL} WHERE res.reservation_id=?`, [cur.reservation_id]);
      const [reservation] = await withBreakfastItems([row]);
      res.json({ reservation, newTotal: updatedTotal });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.post(
  "/api/reservations/:id/cancel",
  auth,
  h(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[cur]] = await conn.query(
        `SELECT res.*, rm.base_price FROM reservations res JOIN rooms rm ON rm.room_id=res.room_id
         WHERE res.reservation_id=? AND res.guest_id=? FOR UPDATE`,
        [req.params.id, req.userId]
      );
      if (!cur) throw new HttpError(404, "Reservation not found.");
      if (cur.status !== "confirmed" || cur.check_out_date < todayISO()) {
        throw new HttpError(400, "This reservation can't be cancelled.");
      }
      const outcome = cancellationOutcome(cur);
      await conn.query(
        "UPDATE reservations SET status='cancelled', cancelled_at=NOW(), refund_amount=? WHERE reservation_id=?",
        [outcome.refund, cur.reservation_id]
      );
      const [[pay]] = await conn.query("SELECT payment_id FROM payments WHERE reservation_id=? LIMIT 1", [
        cur.reservation_id,
      ]);
      if (pay) {
        const total = Number(cur.total_amount);
        const pct = total ? Math.round((outcome.refund / total) * 100) : 0;
        await conn.query("INSERT INTO refunds (payment_id, refund_percentage, refund_amount, reason) VALUES (?,?,?,?)", [
          pay.payment_id, pct, outcome.refund, outcome.free ? "Free cancellation" : "Late cancellation",
        ]);
        if (outcome.refund > 0) {
          await conn.query("UPDATE payments SET status=? WHERE payment_id=?", [
            outcome.refund >= total ? "refunded" : "partially_refunded",
            pay.payment_id,
          ]);
        }
      }
      await notify(conn, req.userId, "cancellation", `Booking ${cur.reference_code} was cancelled.`);
      await conn.commit();
      const [[row]] = await pool.query(`${RES_SQL} WHERE res.reservation_id=?`, [cur.reservation_id]);
      const [reservation] = await withBreakfastItems([row]);
      res.json({ reservation, refund: outcome.refund });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

/* ------------------------------ reviews ------------------------------ */
// No UI for this yet - ready for a "Leave a review" button on completed stays.
app.post(
  "/api/reviews",
  auth,
  h(async (req, res) => {
    const { reservationId, comment = "" } = req.body;
    const rating = Number(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, "Rating must be 1 to 5.");
    const [[r]] = await pool.query("SELECT * FROM reservations WHERE reservation_id=? AND guest_id=?", [
      reservationId,
      req.userId,
    ]);
    if (!r || r.status === "cancelled" || r.check_out_date >= todayISO()) {
      throw new HttpError(400, "You can review a stay after you've checked out.");
    }
    const [[dup]] = await pool.query("SELECT 1 AS x FROM reviews WHERE reservation_id=?", [reservationId]);
    if (dup) throw new HttpError(409, "You already reviewed this stay.");
    await pool.query("INSERT INTO reviews (reservation_id, guest_id, rating, comment) VALUES (?,?,?,?)", [
      reservationId, req.userId, rating, comment || null,
    ]);
    res.status(201).json({});
  })
);

/* ------------------------------ AI recommendations ------------------------------ */
app.use(
  "/api",
  createRecommendations({
    getAllRooms: () => loadRooms(),
    isRoomFree: (roomId, checkIn, checkOut) => isFree(pool, roomId, checkIn, checkOut),
  })
);

/* ------------------------------ node-cron ------------------------------ */

const { refreshRoomRankings } = createRoomRanking(pool);

cron.schedule("0 */6 * * *", () => refreshRoomRankings().catch(console.error));
refreshRoomRankings()
  .then((r) => console.log("Room rankings refreshed:", r))
  .catch((err) => console.error("Room ranking refresh failed:", err));

/* ------------------------------ admin analytics ------------------------------ */

const requireAdmin = async (req, _res, next) => {
  const [[user]] = await pool.query(
    "SELECT user_id, role, is_active FROM users WHERE user_id=? LIMIT 1",
    [req.userId]
  );

  if (!user || !user.is_active) {
    return next(new HttpError(401, "Please log in to continue."));
  }

  if (user.role !== "admin") {
    return next(new HttpError(403, "Admin access required."));
  }

  next();
};

/* ------------------------------ admin reservations ------------------------------ */

function adminReservationStatus(row) {
  const today = todayISO();

  if (row.status === "cancelled") return "cancelled";
  if (row.status === "completed") return "completed";
  if (row.status === "no_show") return "cancelled";

  if (
    row.status === "confirmed" &&
    row.check_in_date <= today &&
    row.check_out_date > today
  ) {
    return "checked-in";
  }

  if (
    row.status === "confirmed" &&
    row.check_in_date > today
  ) {
    return "upcoming";
  }

  return "upcoming";
}


/*
 * GET ALL RESERVATIONS FOR ADMIN
 */
app.get(
  "/api/admin/reservations",
  auth,
  requireAdmin,
  h(async (req, res) => {
    const [rows] = await pool.query(
      `
        SELECT
          r.reservation_id,
          r.reference_code,
          r.guest_name,
          r.guest_email,
          r.guest_phone,
          r.guest_id,

          r.room_id,
          rm.room_name,
          rm.room_type,
          rm.base_price,
          un.room_number,

          r.check_in_date,
          r.check_out_date,

          r.num_guests,
          r.adults,
          r.children,

          r.room_subtotal,
          r.fees_amount,
          r.service_fee_amount,
          r.breakfast_subtotal,
          r.total_amount,

          r.status,
          r.cancelled_at,
          r.checked_out_at,
          r.created_at,
          r.updated_at,

          r.special_requests,
          r.payment_method,
          r.refund_amount,

          p.payment_id,
          p.amount AS payment_amount,
          p.provider,
          p.provider_reference,
          p.status AS payment_status,
          p.paid_at

        FROM reservations r

        JOIN rooms rm
          ON rm.room_id = r.room_id

        LEFT JOIN room_units un
          ON un.unit_id = r.unit_id

        LEFT JOIN payments p
          ON p.payment_id = (
            SELECT p2.payment_id
            FROM payments p2
            WHERE p2.reservation_id = r.reservation_id
            ORDER BY p2.payment_id DESC
            LIMIT 1
          )

        ORDER BY r.created_at DESC
      `
    );

    let breakfastByReservation = new Map();
    if (rows.length > 0) {
      await ensureBreakfastSchema();
      const reservationIds = rows.map((row) => row.reservation_id);
      const [breakfastRows] = await pool.query(
        `SELECT reservation_id, menu_item_id, item_name, unit_price, quantity, line_total
         FROM reservation_menu_items
         WHERE reservation_id IN (${reservationIds.map(() => "?").join(",")})
         ORDER BY reservation_menu_item_id`,
        reservationIds
      );
      breakfastByReservation = new Map();
      for (const item of breakfastRows) {
        const key = String(item.reservation_id);
        const items = breakfastByReservation.get(key) || [];
        items.push({
          itemId: item.menu_item_id,
          name: item.item_name,
          unitPrice: Number(item.unit_price),
          quantity: Number(item.quantity),
          lineTotal: Number(item.line_total),
        });
        breakfastByReservation.set(key, items);
      }
    }

    const reservations = rows.map((r) => ({
      id: String(r.reservation_id),

      referenceCode:
        r.reference_code || `RSV-${r.reservation_id}`,

      guest: {
        name: r.guest_name || "Guest",
        email: r.guest_email || "",
        phone: r.guest_phone || "",
      },

      roomId: r.room_id,
      roomType: r.room_type || "",
      roomName: r.room_name || "",
      roomNumber: r.room_number || r.room_name || "—",

      checkIn: r.check_in_date,
      checkOut: r.check_out_date,

      status: adminReservationStatus(r),

      occupancy: {
        adults: Number(r.adults || 0),
        children: Number(r.children || 0),
      },

      specialRequests: r.special_requests || "",

      payment: {
        total: Number(r.total_amount || 0),
        method: r.payment_method || r.provider || "—",
        transactionId:
          r.provider_reference || `PAY-${r.payment_id || "—"}`,
        status: r.payment_status || "Pending",
      },

      refund: Number(r.refund_amount || 0),

      pricing: {
        roomSubtotal: Number(r.room_subtotal || 0),
        fees: Number(r.fees_amount || 0),
        service: Number(r.service_fee_amount || 0),
        breakfast: Number(r.breakfast_subtotal || 0),
      },
      breakfastItems: breakfastByReservation.get(String(r.reservation_id)) || [],

      activityLog: [
        {
          label:
            r.status === "cancelled"
              ? "Booking cancelled"
              : r.status === "completed"
                ? "Stay completed"
                : "Booking created",
          time: r.created_at,
        },
      ],

      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({
      reservations,
    });
  })
);


/*
 * MODIFY AN ADMIN RESERVATION
 */
app.patch(
  "/api/admin/reservations/:id",
  auth,
  requireAdmin,
  h(async (req, res) => {
    const reservationId = Number(req.params.id);

    if (!Number.isInteger(reservationId)) {
      throw new HttpError(400, "Invalid reservation ID.");
    }

    const {
      checkIn,
      checkOut,
      specialRequests,
    } = req.body;

    if (!DATE.test(checkIn || "") || !DATE.test(checkOut || "")) {
      throw new HttpError(400, "Pick valid dates.");
    }

    if (checkOut <= checkIn) {
      throw new HttpError(
        400,
        "Check-out must be after check-in."
      );
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [[reservation]] = await conn.query(
        `
          SELECT *
          FROM reservations
          WHERE reservation_id = ?
          FOR UPDATE
        `,
        [reservationId]
      );

      if (!reservation) {
        throw new HttpError(404, "Reservation not found.");
      }

      if (
        reservation.status === "cancelled" ||
        reservation.status === "completed"
      ) {
        throw new HttpError(
          400,
          "This reservation can no longer be modified."
        );
      }

      const [[room]] = await conn.query(
        `
          SELECT *
          FROM rooms
          WHERE room_id = ?
          AND is_active = 1
          FOR UPDATE
        `,
        [reservation.room_id]
      );

      if (!room) {
        throw new HttpError(404, "Room not found.");
      }

      const nights = nightsBetween(checkIn, checkOut);

      if (nights < room.min_stay_nights) {
        throw new HttpError(
          400,
          `${room.room_name} requires a ${room.min_stay_nights}-night minimum stay.`
        );
      }

      if (
        reservation.adults + reservation.children >
        room.max_capacity
      ) {
        throw new HttpError(
          400,
          `This room fits up to ${room.max_capacity} guests.`
        );
      }

      const unitId = await findFreeUnit(
        conn,
        reservation.room_id,
        checkIn,
        checkOut,
        reservationId,
        reservation.unit_id || 0
      );

      if (!unitId) {
        throw new HttpError(
          409,
          "Those dates are already booked for this room."
        );
      }

      const p = pricing(
        Number(room.base_price),
        nights
      );

      await conn.query(
        `
          UPDATE reservations
          SET
            check_in_date = ?,
            check_out_date = ?,
            room_subtotal = ?,
            fees_amount = ?,
            service_fee_amount = ?,
            total_amount = ?,
            special_requests = ?,
            unit_id = ?
          WHERE reservation_id = ?
        `,
        [
          checkIn,
          checkOut,
          p.subtotal,
          p.fees,
          p.service,
          p.total,
          specialRequests || null,
          unitId,
          reservationId,
        ]
      );

      await conn.query(
        `
          UPDATE payments
          SET amount = ?
          WHERE reservation_id = ?
            AND status IN ('pending', 'paid')
        `,
        [p.total, reservationId]
      );

      await conn.commit();

      const [[updated]] = await pool.query(
        `
          SELECT
            r.*,
            rm.room_name,
            rm.room_type,
            un.room_number,
            p.payment_id,
            p.provider,
            p.provider_reference,
            p.status AS payment_status
          FROM reservations r
          JOIN rooms rm
            ON rm.room_id = r.room_id
          LEFT JOIN room_units un
            ON un.unit_id = r.unit_id
          LEFT JOIN payments p
            ON p.payment_id = (
              SELECT p2.payment_id
              FROM payments p2
              WHERE p2.reservation_id = r.reservation_id
              ORDER BY p2.payment_id DESC
              LIMIT 1
            )
          WHERE r.reservation_id = ?
        `,
        [reservationId]
      );

      res.json({
        reservation: {
          id: String(updated.reservation_id),
          referenceCode: updated.reference_code,
          guest: {
            name: updated.guest_name || "Guest",
            email: updated.guest_email || "",
            phone: updated.guest_phone || "",
          },
          roomId: updated.room_id,
          roomType: updated.room_type,
          roomName: updated.room_name,
          roomNumber: updated.room_number || updated.room_name,
          checkIn: updated.check_in_date,
          checkOut: updated.check_out_date,
          status: adminReservationStatus(updated),
          occupancy: {
            adults: Number(updated.adults || 0),
            children: Number(updated.children || 0),
          },
          specialRequests:
            updated.special_requests || "",
          payment: {
            total: Number(updated.total_amount || 0),
            method:
              updated.payment_method ||
              updated.provider ||
              "—",
            transactionId:
              updated.provider_reference ||
              `PAY-${updated.payment_id || "—"}`,
            status:
              updated.payment_status || "Pending",
          },
        },
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);


/*
 * CANCEL RESERVATION AS ADMIN
 */
app.post(
  "/api/admin/reservations/:id/cancel",
  auth,
  requireAdmin,
  h(async (req, res) => {
    const reservationId = Number(req.params.id);

    if (!Number.isInteger(reservationId)) {
      throw new HttpError(400, "Invalid reservation ID.");
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [[reservation]] = await conn.query(
        `
          SELECT *
          FROM reservations
          WHERE reservation_id = ?
          FOR UPDATE
        `,
        [reservationId]
      );

      if (!reservation) {
        throw new HttpError(
          404,
          "Reservation not found."
        );
      }

      if (
        reservation.status === "cancelled" ||
        reservation.status === "completed"
      ) {
        throw new HttpError(
          400,
          "This reservation cannot be cancelled."
        );
      }

      await conn.query(
        `
          UPDATE reservations
          SET
            status = 'cancelled',
            cancelled_at = NOW(),
            refund_amount = 0
          WHERE reservation_id = ?
        `,
        [reservationId]
      );

      await conn.query(
        `
          UPDATE payments
          SET status = 'refunded'
          WHERE reservation_id = ?
            AND status = 'paid'
        `,
        [reservationId]
      );

      await conn.commit();

      res.json({
        success: true,
        id: String(reservationId),
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

app.get(
  "/api/admin/dashboard",
  auth,
  requireAdmin,
  h(async (req, res) => {
    const today = new Date();

    const pad = (n) => String(n).padStart(2, "0");

    const todayDate = `${today.getFullYear()}-${pad(
      today.getMonth() + 1
    )}-${pad(today.getDate())}`;

    /*
     * 1. Today's check-ins
     */
    const [[checkInResult]] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM reservations
        WHERE check_in_date = ?
          AND status IN ('confirmed', 'completed')
      `,
      [todayDate]
    );

    /*
     * 2. Today's check-outs
     */
    const [[checkOutResult]] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM reservations
        WHERE check_out_date = ?
          AND status IN ('confirmed', 'completed')
      `,
      [todayDate]
    );

    /*
     * 3. Active rooms
     */
    const [[roomResult]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM room_units
        WHERE is_active = 1
      `
    );

    /*
     * 4. Currently occupied rooms
     *
     * A room is considered occupied when:
     * - reservation is confirmed
     * - today's date is >= check-in
     * - today's date is < check-out
     */
    const [[occupiedResult]] = await pool.query(
      `
        SELECT COUNT(DISTINCT unit_id) AS occupied
        FROM reservations
        WHERE status = 'confirmed'
          AND check_in_date <= ?
          AND check_out_date > ?
      `,
      [todayDate, todayDate]
    );

    const totalRooms = Number(roomResult.total || 0);
    const occupiedRooms = Number(occupiedResult.occupied || 0);
    const availableRooms = Math.max(
      totalRooms - occupiedRooms,
      0
    );

    const occupancy =
      totalRooms > 0
        ? Math.round((occupiedRooms / totalRooms) * 100)
        : 0;

    /*
     * 5. Room mix
     *
     * Uses your actual room_type values.
     */
    const [roomMixRows] = await pool.query(
      `
        SELECT
          rm.room_type AS name,
          COUNT(u.unit_id) AS count
        FROM rooms rm
        JOIN room_units u
          ON u.room_id = rm.room_id AND u.is_active = 1
        WHERE rm.is_active = 1
        GROUP BY rm.room_type
        ORDER BY count DESC, rm.room_type
      `
    );

    const roomMix = roomMixRows.map((row) => {
      const count = Number(row.count || 0);

      return {
        name: row.name,
        count,
        pct:
          totalRooms > 0
            ? Math.round((count / totalRooms) * 100)
            : 0,
      };
    });

    /*
     * 6. Today's reservations
     *
     * Includes reservations checking in or checking out today.
     */
    const [reservationRows] = await pool.query(
      `
        SELECT
          r.reservation_id,
          r.guest_name,
          r.check_in_date,
          r.check_out_date,
          r.status,
          rm.room_name,
          un.room_number
        FROM reservations r
        JOIN rooms rm
          ON rm.room_id = r.room_id
        LEFT JOIN room_units un
          ON un.unit_id = r.unit_id
        WHERE
          r.check_in_date = ?
          OR r.check_out_date = ?
        ORDER BY
          CASE
            WHEN r.check_in_date = ? THEN 0
            ELSE 1
          END,
          r.check_in_date ASC,
          r.created_at DESC
        LIMIT 10
      `,
      [todayDate, todayDate, todayDate]
    );

    const todayReservations = reservationRows.map((row) => {
      let displayStatus = "Pending";

      if (row.status === "confirmed") {
        /*
         * Derive "Checked-in" from the reservation dates.
         * Your database does not currently have a checked_in status.
         */
        if (
          row.check_in_date < todayDate &&
          row.check_out_date > todayDate
        ) {
          displayStatus = "Checked-in";
        } else {
          displayStatus = "Confirmed";
        }
      }

      if (row.status === "pending_payment") {
        displayStatus = "Pending";
      }

      return {
        id: row.reservation_id,
        guest: row.guest_name || "Guest",
        room: row.room_name,
        roomNumber: row.room_number || "",
        checkIn: row.check_in_date,
        checkOut: row.check_out_date,
        status: displayStatus,
      };
    });

    /*
     * 7. Recent activity
     *
     * Since there is no activity_log table in the current schema,
     * we derive recent activity from reservations.
     */
    const [activityRows] = await pool.query(
      `
        SELECT
          r.reservation_id,
          r.guest_name,
          r.status,
          r.created_at,
          rm.room_name
        FROM reservations r
        JOIN rooms rm
          ON rm.room_id = r.room_id
        ORDER BY r.created_at DESC
        LIMIT 6
      `
    );

    const recentActivity = activityRows.map((row) => {
      let text;
      let color = "#1F4D3D";

      if (row.status === "confirmed") {
        text = `New booking: ${row.guest_name || "Guest"} — ${row.room_name}`;
      } else if (row.status === "cancelled") {
        text = `Cancellation: ${row.guest_name || "Guest"} — ${row.room_name}`;
        color = "#E8935C";
      } else if (row.status === "completed") {
        text = `Completed stay: ${row.guest_name || "Guest"} — ${row.room_name}`;
        color = "#2C5F8A";
      } else if (row.status === "no_show") {
        text = `No-show: ${row.guest_name || "Guest"} — ${row.room_name}`;
        color = "#E8935C";
      } else {
        text = `Pending booking: ${row.guest_name || "Guest"} — ${row.room_name}`;
        color = "#B5791E";
      }

      return {
        id: row.reservation_id,
        text,
        time: row.created_at,
        color,
      };
    });

    res.json({
      date: todayDate,

      stats: {
        checkIns: Number(checkInResult.count || 0),
        checkOuts: Number(checkOutResult.count || 0),
        occupancy,
        occupiedRooms,
        totalRooms,
        availableRooms,
      },

      roomMix,

      todayReservations,

      recentActivity,
    });
  })
);

const ANALYTICS_DATE = /^\d{4}-\d{2}-\d{2}$/;

function analyticsDate(value) {
  return ANALYTICS_DATE.test(String(value || "")) ? value : null;
}

function previousPeriod(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const days =
    Math.round((end - start) / 86400000) + 1;

  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);

  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    start: iso(previousStart),
    end: iso(previousEnd),
  };
}

async function getAnalyticsSummary(startDate, endDate) {
  const [[summary]] = await pool.query(
    `
    SELECT
      (
        SELECT COALESCE(SUM(
          p.amount - COALESCE(
            (
              SELECT SUM(rf.refund_amount)
              FROM refunds rf
              WHERE rf.payment_id = p.payment_id
            ),
            0
          )
        ), 0)
        FROM payments p
        WHERE p.status IN ('paid', 'refunded', 'partially_refunded')
          AND DATE(COALESCE(p.paid_at, p.created_at))
              BETWEEN ? AND ?
      ) AS revenue,

      (
        SELECT COUNT(*)
        FROM reservations res
        WHERE DATE(res.created_at) BETWEEN ? AND ?
      ) AS bookings,

      (
        SELECT COUNT(*)
        FROM reservations res
        WHERE res.status = 'cancelled'
          AND DATE(res.created_at) BETWEEN ? AND ?
      ) AS cancellations,

      (
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            DATEDIFF(
              LEAST(res.check_out_date, DATE_ADD(?, INTERVAL 1 DAY)),
              GREATEST(res.check_in_date, ?)
            )
          )
        ), 0)
        FROM reservations res
        WHERE res.status IN ('confirmed', 'completed')
          AND res.check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
          AND res.check_out_date > ?
      ) AS occupied_nights,

      (
        SELECT COUNT(*)
        FROM room_units
        WHERE is_active = 1
      ) AS active_rooms
    `,
    [
      startDate,
      endDate,

      startDate,
      endDate,

      startDate,
      endDate,

      endDate,
      startDate,
      endDate,
      startDate,
    ]
  );

  const revenue = Number(summary.revenue || 0);
  const bookings = Number(summary.bookings || 0);
  const cancellations = Number(summary.cancellations || 0);
  const occupiedNights = Number(summary.occupied_nights || 0);
  const activeRooms = Number(summary.active_rooms || 0);

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const days =
    Math.round((end - start) / 86400000) + 1;

  const availableRoomNights = activeRooms * days;

  const occupancy =
    availableRoomNights > 0
      ? (occupiedNights / availableRoomNights) * 100
      : 0;

  const adr =
    occupiedNights > 0
      ? revenue / occupiedNights
      : 0;

  const cancellationRate =
    bookings > 0
      ? (cancellations / bookings) * 100
      : 0;

  return {
    revenue: round2(revenue),
    occupancy: round2(occupancy),
    adr: round2(adr),
    bookings,
    cancellations,
    cancellationRate: round2(cancellationRate),
    occupiedNights,
    availableRoomNights,
  };
}

async function getRevenueTrend(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      DATE(COALESCE(p.paid_at, p.created_at)) AS date,
      COALESCE(
        SUM(
          p.amount - COALESCE(
            (
              SELECT SUM(rf.refund_amount)
              FROM refunds rf
              WHERE rf.payment_id = p.payment_id
            ),
            0
          )
        ),
        0
      ) AS revenue
    FROM payments p
    WHERE p.status IN ('paid', 'refunded', 'partially_refunded')
      AND DATE(COALESCE(p.paid_at, p.created_at))
          BETWEEN ? AND ?
    GROUP BY DATE(COALESCE(p.paid_at, p.created_at))
    ORDER BY date
    `,
    [startDate, endDate]
  );

  return rows.map((r) => ({
    date: r.date,
    revenue: round2(Number(r.revenue || 0)),
  }));
}

async function getOccupancyTrend(startDate, endDate) {
  const [rows] = await pool.query(
    `
    WITH RECURSIVE dates AS (
      SELECT CAST(? AS DATE) AS date
      UNION ALL
      SELECT DATE_ADD(date, INTERVAL 1 DAY)
      FROM dates
      WHERE date < CAST(? AS DATE)
    )
    SELECT
      d.date,
      COUNT(DISTINCT res.unit_id) AS occupied,
      (
        SELECT COUNT(*)
        FROM room_units
        WHERE is_active = 1
      ) AS available
    FROM dates d
    LEFT JOIN reservations res
      ON res.status IN ('confirmed', 'completed')
      AND res.check_in_date <= d.date
      AND res.check_out_date > d.date
    GROUP BY d.date
    ORDER BY d.date
    `,
    [startDate, endDate]
  );

  return rows.map((r) => ({
    date: r.date,
    occupied: Number(r.occupied || 0),
    available: Number(r.available || 0),
    occupancy:
      Number(r.available || 0) > 0
        ? round2(
            (Number(r.occupied || 0) /
              Number(r.available)) *
              100
          )
        : 0,
  }));
}

async function getRevenueByRoomType(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      rm.room_type,
      COALESCE(
        SUM(
          p.amount - COALESCE(
            (
              SELECT SUM(rf.refund_amount)
              FROM refunds rf
              WHERE rf.payment_id = p.payment_id
            ),
            0
          )
        ),
        0
      ) AS revenue
    FROM payments p
    JOIN reservations res
      ON res.reservation_id = p.reservation_id
    JOIN rooms rm
      ON rm.room_id = res.room_id
    WHERE p.status IN ('paid', 'refunded', 'partially_refunded')
      AND DATE(COALESCE(p.paid_at, p.created_at))
          BETWEEN ? AND ?
    GROUP BY rm.room_type
    ORDER BY revenue DESC
    `,
    [startDate, endDate]
  );

  return rows.map((r) => ({
    name: r.room_type,
    value: round2(Number(r.revenue || 0)),
  }));
}

async function getPaymentMethods(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(res.payment_method, ''), 'Unknown') AS method,
      COUNT(*) AS bookings
    FROM reservations res
    WHERE DATE(res.created_at) BETWEEN ? AND ?
    GROUP BY COALESCE(NULLIF(res.payment_method, ''), 'Unknown')
    ORDER BY bookings DESC
    `,
    [startDate, endDate]
  );

  return rows.map((r) => ({
    name: r.method,
    value: Number(r.bookings || 0),
  }));
}

async function getTopRooms(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      rm.room_id,
      rm.room_name,
      rm.room_type,
      rm.is_popular,

      COUNT(
        CASE
          WHEN res.status IN ('confirmed', 'completed')
          THEN res.reservation_id
        END
      ) AS bookings,

      COALESCE(
        SUM(
          CASE
            WHEN p.status IN ('paid', 'refunded', 'partially_refunded')
            THEN p.amount - COALESCE(
              (
                SELECT SUM(rf.refund_amount)
                FROM refunds rf
                WHERE rf.payment_id = p.payment_id
              ),
              0
            )
            ELSE 0
          END
        ),
        0
      ) AS revenue,

      COALESCE(
        SUM(
          CASE
            WHEN res.status IN ('confirmed', 'completed')
            THEN GREATEST(
              0,
              DATEDIFF(
                LEAST(res.check_out_date, DATE_ADD(?, INTERVAL 1 DAY)),
                GREATEST(res.check_in_date, ?)
              )
            )
            ELSE 0
          END
        ),
        0
      ) AS occupied_nights

    FROM rooms rm

    LEFT JOIN reservations res
      ON res.room_id = rm.room_id
      AND res.check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
      AND res.check_out_date > ?

    LEFT JOIN payments p
      ON p.reservation_id = res.reservation_id

    WHERE rm.is_active = 1

    GROUP BY
      rm.room_id,
      rm.room_name,
      rm.room_type,
      rm.is_popular

    ORDER BY revenue DESC, bookings DESC, rm.room_name
    `,
    [
      endDate,
      startDate,
      endDate,
      startDate,
    ]
  );

  return rows.map((r) => ({
    id: r.room_id,
    name: r.room_name,
    type: r.room_type,
    bookings: Number(r.bookings || 0),
    revenue: round2(Number(r.revenue || 0)),
    occupiedNights: Number(r.occupied_nights || 0),
    popular: !!r.is_popular,
  }));
}

app.get(
  "/api/admin/analytics",
  auth,
  requireAdmin,
  h(async (req, res) => {
    const today = todayISO();

    let startDate = analyticsDate(req.query.startDate);
    let endDate = analyticsDate(req.query.endDate);

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      );

      endDate = `${nextMonth.getFullYear()}-${pad(
        nextMonth.getMonth() + 1
      )}-${pad(nextMonth.getDate())}`;
    }

    if (startDate > endDate) {
      throw new HttpError(
        400,
        "Start date cannot be after end date."
      );
    }

    const previous = previousPeriod(startDate, endDate);

    const [
      current,
      previousSummary,
      revenueTrend,
      occupancyTrend,
      revenueByRoomType,
      paymentMethods,
      topRooms,
    ] = await Promise.all([
      getAnalyticsSummary(startDate, endDate),
      getAnalyticsSummary(previous.start, previous.end),
      getRevenueTrend(startDate, endDate),
      getOccupancyTrend(startDate, endDate),
      getRevenueByRoomType(startDate, endDate),
      getPaymentMethods(startDate, endDate),
      getTopRooms(startDate, endDate),
    ]);

    const percentageChange = (currentValue, previousValue) => {
      if (previousValue === 0) {
        return currentValue === 0 ? 0 : 100;
      }

      return round2(
        ((currentValue - previousValue) /
          Math.abs(previousValue)) *
          100
      );
    };

    res.json({
      range: {
        startDate,
        endDate,
        previousStartDate: previous.start,
        previousEndDate: previous.end,
      },

      summary: current,

      comparison: {
        revenue: percentageChange(
          current.revenue,
          previousSummary.revenue
        ),

        occupancy: percentageChange(
          current.occupancy,
          previousSummary.occupancy
        ),

        adr: percentageChange(
          current.adr,
          previousSummary.adr
        ),

        bookings: percentageChange(
          current.bookings,
          previousSummary.bookings
        ),

        cancellationRate: percentageChange(
          current.cancellationRate,
          previousSummary.cancellationRate
        ),
      },

      revenueTrend,
      occupancyTrend,
      revenueByRoomType,
      paymentMethods,
      topRooms,
    });
  })
);

/* ------------------------------ Admin Routes ------------------------------ */
  app.use("/uploads", express.static(fileURLToPath(new URL("./uploads", import.meta.url))));
  app.use("/api/admin", auth, h(requireAdmin), createAdminRoutes(pool));

/* ------------------------------ errors ------------------------------ */

app.use((err, _req, res, _next) => {
  const known = err instanceof HttpError;
  if (!known) console.error(err);
  res.status(known ? err.status : 500).json({ error: known ? err.message : "Something went wrong on our end." });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`StayEase API running on http://localhost:${port}`));