import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Mounted behind your existing `auth` + `requireAdmin`, so req.userId is the admin.
// Routes: /rooms, /rooms/:id/units, /units/:unitId, /room-options,
//         /housekeeping, /housekeepers, /settings.
//
// Model: a `rooms` row is a room TYPE (e.g. "Presidential Suite").
//        `room_units` rows are the physical rooms of that type (501, 502, 503, 504).

const UPLOAD_DIR = fileURLToPath(new URL("../uploads/rooms/", import.meta.url));
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_UNITS_PER_BATCH = 50;
const STATUSES = ["dirty", "in-progress", "clean-ready", "inspected"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOM_NUMBER = /^[A-Za-z0-9-]{1,20}$/;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Only these keys can be saved from the Settings page.
const SETTING_FIELDS = {
  hotelName: { type: "string" },
  contactEmail: { type: "string" },
  contactPhone: { type: "string" },
  address: { type: "string" },
  checkInTime: { type: "time" },
  checkOutTime: { type: "time" },
  cancellationHours: { type: "number", max: 720 },
  feeRate: { type: "number", max: 100 },
  serviceRate: { type: "number", max: 100 },
};

const SETTING_DEFAULTS = {
  hotelName: "StayEase",
  contactEmail: "",
  contactPhone: "",
  address: "",
  checkInTime: "15:00",
  checkOutTime: "12:00",
  cancellationHours: 48,
  feeRate: 12,
  serviceRate: 5,
};

function coerceSetting(key, raw) {
  const { type, max } = SETTING_FIELDS[key];
  if (type === "string") return String(raw ?? "").trim().slice(0, 255);
  if (type === "time") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw))) throw new ApiError(400, "Enter times like 14:00.");
    return String(raw);
  }
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n) || n < 0 || n > max) {
    throw new ApiError(400, `${key} must be a number from 0 to ${max}.`);
  }
  return n;
}

function formatMinutes(m) {
  m = Math.max(0, Number(m) || 0);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

const splitName = (full) => {
  const [first = "", ...rest] = String(full).trim().split(/\s+/);
  return { first: first.slice(0, 80), last: rest.join(" ").slice(0, 80) };
};

// "501" x 4 -> 501, 502, 503, 504. Floor defaults to the hundreds digit (501 -> floor 5).
function buildUnits(quantity, firstRoomNumber, floorInput) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_UNITS_PER_BATCH) {
    throw new ApiError(400, `Number of rooms must be between 1 and ${MAX_UNITS_PER_BATCH}.`);
  }
  const first = String(firstRoomNumber ?? "").trim();
  if (!/^\d{1,6}$/.test(first)) throw new ApiError(400, "Enter the first room number, like 501.");
  const start = Number(first);
  if (start + qty - 1 > 999999) throw new ApiError(400, "Room numbers are too large.");

  let fixedFloor = null;
  if (floorInput !== undefined && floorInput !== null && floorInput !== "") {
    fixedFloor = Number(floorInput);
    if (!Number.isInteger(fixedFloor) || fixedFloor < 1 || fixedFloor > 99) {
      throw new ApiError(400, "Floor must be a number from 1 to 99.");
    }
  }

  const width = first.length; // keep leading zeros: 001 -> 001, 002
  return Array.from({ length: qty }, (_, i) => {
    const n = start + i;
    return {
      roomNumber: String(n).padStart(width, "0"),
      floor: fixedFloor ?? Math.min(99, Math.max(1, Math.floor(n / 100))),
    };
  });
}

const mapUnit = (u) => ({ id: u.unit_id, roomNumber: u.room_number, floor: u.floor, active: !!u.is_active });

const mapRoom = (r, units = []) => ({
  id: r.room_id,
  name: r.room_name,
  type: r.room_type,
  price: Number(r.base_price),
  minStay: r.min_stay_nights,
  capacity: r.max_capacity,
  size: r.sqm ?? null,
  popular: !!r.is_popular,
  active: !!r.is_active,
  images: r.thumb ? [r.thumb] : [],
  unitCount: units.filter((u) => u.active).length,
  units,
});

const THUMB_SQL = `(SELECT image_url FROM room_images WHERE room_id = r.room_id
                    ORDER BY is_primary DESC, sort_order, image_id LIMIT 1) AS thumb`;

// One row per physical room on the housekeeping board.
const HK_SELECT = `
  SELECT rh.unit_id, u.room_number, u.floor, rm.room_id, rm.room_name,
         rh.hk_status, rh.rush, rh.notes, rh.assigned_to,
         TRIM(CONCAT(us.first_name, ' ', us.last_name)) AS assignee,
         TIMESTAMPDIFF(MINUTE, rh.status_changed_at, NOW()) AS minutes
  FROM room_housekeeping rh
  JOIN room_units u ON u.unit_id = rh.unit_id
  JOIN rooms rm ON rm.room_id = u.room_id
  LEFT JOIN users us ON us.user_id = rh.assigned_to`;

const mapHk = (r) => ({
  id: r.unit_id, // the board works per physical room
  room: r.room_number,
  type: r.room_name,
  roomTypeId: r.room_id,
  floor: r.floor,
  status: r.hk_status,
  assignee: r.assignee || null,
  assigneeId: r.assigned_to || null,
  rush: !!r.rush,
  notes: r.notes || "",
  time: formatMinutes(r.minutes),
});

export default function createAdminRoutes(pool) {
  const router = Router();
  const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  let roomColumns = null;
  async function roomHasColumn(name) {
    if (!roomColumns) {
      const [cols] = await pool.query("SHOW COLUMNS FROM rooms");
      roomColumns = new Set(cols.map((c) => c.Field));
    }
    return roomColumns.has(name);
  }

  async function loadUnits(roomIds) {
    const byRoom = new Map();
    if (!roomIds.length) return byRoom;
    const [rows] = await pool.query(
      `SELECT unit_id, room_id, room_number, floor, is_active FROM room_units
       WHERE room_id IN (?) ORDER BY CAST(room_number AS UNSIGNED), room_number`,
      [roomIds]
    );
    for (const u of rows) {
      if (!byRoom.has(u.room_id)) byRoom.set(u.room_id, []);
      byRoom.get(u.room_id).push(mapUnit(u));
    }
    return byRoom;
  }

  async function getRoom(roomId) {
    const [rows] = await pool.query(`SELECT r.*, ${THUMB_SQL} FROM rooms r WHERE r.room_id = ?`, [roomId]);
    if (!rows.length) throw new ApiError(404, "Room not found.");
    const units = await loadUnits([roomId]);
    return mapRoom(rows[0], units.get(roomId) || []);
  }

  async function assertNumbersFree(conn, numbers) {
    const [taken] = await conn.query("SELECT room_number FROM room_units WHERE room_number IN (?)", [numbers]);
    if (taken.length) {
      throw new ApiError(409, `Room number ${taken.map((t) => t.room_number).join(", ")} already exists.`);
    }
  }

  async function loadSettings() {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM settings");
    const out = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      if (!(row.setting_key in SETTING_FIELDS)) continue;
      try {
        out[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        /* keep the default if a stored value is corrupt */
      }
    }
    return out;
  }

  async function getHkRoom(unitId) {
    const [rows] = await pool.query(`${HK_SELECT} WHERE rh.unit_id = ?`, [unitId]);
    if (!rows.length) throw new ApiError(404, "Room not found.");
    return mapHk(rows[0]);
  }

  async function assertHousekeeper(userId) {
    const [rows] = await pool.query(
      "SELECT user_id FROM users WHERE user_id = ? AND role = 'housekeeping' AND is_active = 1",
      [userId]
    );
    if (!rows.length) throw new ApiError(400, "Pick a valid housekeeper.");
  }

  /* ------------------------------ room types ------------------------------ */

  router.get("/rooms", h(async (_req, res) => {
    const [rows] = await pool.query(`SELECT r.*, ${THUMB_SQL} FROM rooms r ORDER BY r.room_id DESC`);
    const units = await loadUnits(rows.map((r) => r.room_id));
    res.json(rows.map((r) => mapRoom(r, units.get(r.room_id) || [])));
  }));

  // Existing room types and amenities, so the Add Room form matches the guest side.
  router.get("/room-options", h(async (_req, res) => {
    const [types] = await pool.query("SELECT DISTINCT room_type FROM rooms ORDER BY room_type");
    const [amenities] = await pool.query("SELECT amenity_id AS id, name FROM amenities ORDER BY amenity_id");
    res.json({ types: types.map((t) => t.room_type), amenities });
  }));

  router.post("/rooms", h(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const type = String(b.type || "").trim();
    const price = Number(b.price);
    const minStay = Number(b.minStay);
    const capacity = Number(b.capacity);
    const size = b.size ? Number(b.size) : null;

    if (!name) throw new ApiError(400, "Room name is required.");
    if (name.length > 100) throw new ApiError(400, "Room name is too long.");
    if (!type || type.length > 60) throw new ApiError(400, "Room type is required.");
    if (!(price > 0)) throw new ApiError(400, "Enter a valid price per night.");
    if (!Number.isInteger(minStay) || minStay < 1 || minStay > 60) throw new ApiError(400, "Enter a valid minimum stay.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) throw new ApiError(400, "Enter a valid max capacity.");
    if (size !== null && !(size > 0)) throw new ApiError(400, "Enter a valid room size.");

    // The physical rooms of this type: e.g. 4 rooms starting at 501 -> 501..504.
    const units = buildUnits(b.quantity ?? 1, b.firstRoomNumber, b.floor);

    // Amenities must already exist (the guest side maps them to icons).
    const wanted = [...new Set((Array.isArray(b.amenityIds) ? b.amenityIds : []).map(Number).filter(Number.isInteger))];
    let amenityIds = [];
    if (wanted.length) {
      const [found] = await pool.query("SELECT amenity_id FROM amenities WHERE amenity_id IN (?)", [wanted]);
      amenityIds = found.map((a) => a.amenity_id);
    }

    // Decode uploads (data URLs from the form) into files; the DB stores only the URL.
    const rawImages = (Array.isArray(b.images) ? b.images : []).slice(0, MAX_IMAGES);
    const files = rawImages.map((src) => {
      const m = /^data:image\/(png|jpeg);base64,(.+)$/s.exec(String(src));
      if (!m) throw new ApiError(400, "Images must be JPG or PNG.");
      const buffer = Buffer.from(m[2], "base64");
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ApiError(400, "Each image must be under 4 MB.");
      return { buffer, filename: `${randomUUID()}.${m[1] === "png" ? "png" : "jpg"}` };
    });

    const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
    const urls = files.map((f) => `${base}/uploads/rooms/${f.filename}`);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const written = [];
    const conn = await pool.getConnection();
    try {
      await assertNumbersFree(conn, units.map((u) => u.roomNumber));

      for (const f of files) {
        const full = path.join(UPLOAD_DIR, f.filename);
        await writeFile(full, f.buffer);
        written.push(full);
      }

      await conn.beginTransaction();
      const cols = ["room_name", "room_type", "description", "base_price", "max_capacity", "min_stay_nights", "is_popular", "is_active"];
      const vals = [name, type, String(b.description || "").trim() || null, price, capacity, minStay, b.popular ? 1 : 0, b.active === false ? 0 : 1];
      if (await roomHasColumn("sqm")) {
        cols.push("sqm");
        vals.push(size);
      }
      const [result] = await conn.query(
        `INSERT INTO rooms (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        vals
      );
      const id = result.insertId;
      await conn.query("INSERT INTO room_units (room_id, room_number, floor) VALUES ?", [
        units.map((u) => [id, u.roomNumber, u.floor]),
      ]);
      if (amenityIds.length) {
        await conn.query("INSERT INTO room_amenities (room_id, amenity_id) VALUES ?", [amenityIds.map((a) => [id, a])]);
      }
      if (urls.length) {
        await conn.query("INSERT INTO room_images (room_id, image_url, is_primary, sort_order) VALUES ?", [
          urls.map((u, i) => [id, u, i === 0 ? 1 : 0, i]),
        ]);
      }
      await conn.commit();
      res.status(201).json(await getRoom(id));
    } catch (err) {
      await conn.rollback().catch(() => {});
      await Promise.all(written.map((p) => unlink(p).catch(() => {})));
      throw err;
    } finally {
      conn.release();
    }
  }));

  /* ------------------------------ physical rooms (units) ------------------------------ */

  // Add more rooms to an existing type, e.g. 2 more Presidential Suites starting at 505.
  router.post("/rooms/:id/units", h(async (req, res) => {
    const roomId = Number(req.params.id);
    if (!Number.isInteger(roomId)) throw new ApiError(400, "Invalid room type.");
    const b = req.body || {};
    const units = buildUnits(b.quantity ?? 1, b.firstRoomNumber, b.floor);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[type]] = await conn.query("SELECT room_id FROM rooms WHERE room_id = ? FOR UPDATE", [roomId]);
      if (!type) throw new ApiError(404, "Room not found.");
      await assertNumbersFree(conn, units.map((u) => u.roomNumber));
      await conn.query("INSERT INTO room_units (room_id, room_number, floor) VALUES ?", [
        units.map((u) => [roomId, u.roomNumber, u.floor]),
      ]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    res.status(201).json(await getRoom(roomId));
  }));

  // Rename, change floor, or take a room out of service / put it back.
  router.patch("/units/:unitId", h(async (req, res) => {
    const unitId = Number(req.params.unitId);
    if (!Number.isInteger(unitId)) throw new ApiError(400, "Invalid room.");
    const b = req.body || {};

    const sets = [];
    const vals = [];
    if (b.roomNumber !== undefined) {
      const num = String(b.roomNumber).trim();
      if (!ROOM_NUMBER.test(num)) throw new ApiError(400, "Room number can use letters, numbers and dashes (max 20).");
      sets.push("room_number = ?");
      vals.push(num);
    }
    if (b.floor !== undefined) {
      const floor = Number(b.floor);
      if (!Number.isInteger(floor) || floor < 1 || floor > 99) throw new ApiError(400, "Floor must be a number from 1 to 99.");
      sets.push("floor = ?");
      vals.push(floor);
    }
    if (b.active !== undefined) {
      sets.push("is_active = ?");
      vals.push(b.active ? 1 : 0);
    }
    if (!sets.length) throw new ApiError(400, "Nothing to update.");

    const conn = await pool.getConnection();
    let roomId;
    try {
      await conn.beginTransaction();
      const [[unit]] = await conn.query("SELECT unit_id, room_id, room_number FROM room_units WHERE unit_id = ?", [unitId]);
      if (!unit) throw new ApiError(404, "Room not found.");
      roomId = unit.room_id;

      // Same lock the booking code takes, so a booking can't sneak in mid-change.
      await conn.query("SELECT room_id FROM rooms WHERE room_id = ? FOR UPDATE", [roomId]);

      if (b.active === false || b.active === 0) {
        const [[{ n }]] = await conn.query(
          `SELECT COUNT(*) AS n FROM reservations
           WHERE unit_id = ? AND status IN ('pending_payment','confirmed') AND check_out_date >= CURDATE()`,
          [unitId]
        );
        if (Number(n) > 0) {
          throw new ApiError(
            400,
            `Room ${unit.room_number} has ${n} upcoming booking${Number(n) === 1 ? "" : "s"}. Move or cancel them before taking it out of service.`
          );
        }
      }

      await conn.query(`UPDATE room_units SET ${sets.join(", ")} WHERE unit_id = ?`, [...vals, unitId]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    res.json(await getRoom(roomId));
  }));

  /* ------------------------------ housekeeping ------------------------------ */

  router.get("/housekeeping", h(async (_req, res) => {
    // Every active room gets a board row the first time it's seen (new rooms included).
    await pool.query("INSERT IGNORE INTO room_housekeeping (unit_id) SELECT unit_id FROM room_units WHERE is_active = 1");
    const [rooms] = await pool.query(
      `${HK_SELECT} WHERE u.is_active = 1 AND rm.is_active = 1 ORDER BY u.floor, CAST(u.room_number AS UNSIGNED), u.room_number`
    );
    const [staff] = await pool.query(
      `SELECT user_id AS id, TRIM(CONCAT(first_name, ' ', last_name)) AS name
       FROM users WHERE role = 'housekeeping' AND is_active = 1 ORDER BY first_name, last_name`
    );
    res.json({ rooms: rooms.map(mapHk), housekeepers: staff });
  }));

  router.patch("/housekeeping/:id/status", h(async (req, res) => {
    const unitId = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isInteger(unitId)) throw new ApiError(400, "Invalid room.");
    if (!STATUSES.includes(status)) throw new ApiError(400, "Invalid status.");

    const [[cur]] = await pool.query(
      `SELECT rh.hk_status, u.room_id FROM room_housekeeping rh
       JOIN room_units u ON u.unit_id = rh.unit_id WHERE rh.unit_id = ?`,
      [unitId]
    );
    if (!cur) throw new ApiError(404, "Room not found.");

    if (cur.hk_status !== status) {
      await pool.query("UPDATE room_housekeeping SET hk_status = ?, status_changed_at = NOW() WHERE unit_id = ?", [status, unitId]);
      await pool.query(
        "INSERT INTO housekeeping_logs (room_id, unit_id, staff_id, status_from, status_to) VALUES (?, ?, ?, ?, ?)",
        [cur.room_id, unitId, req.userId, cur.hk_status, status]
      );
    }
    res.json(await getHkRoom(unitId));
  }));

  router.patch("/housekeeping/:id/assign", h(async (req, res) => {
    const unitId = Number(req.params.id);
    if (!Number.isInteger(unitId)) throw new ApiError(400, "Invalid room.");
    const { assigneeId, rush, notes } = req.body || {};

    const [[cur]] = await pool.query(
      `SELECT rh.hk_status, u.room_id FROM room_housekeeping rh
       JOIN room_units u ON u.unit_id = rh.unit_id WHERE rh.unit_id = ?`,
      [unitId]
    );
    if (!cur) throw new ApiError(404, "Room not found.");

    let staffId = null;
    if (assigneeId) {
      staffId = Number(assigneeId);
      await assertHousekeeper(staffId);
    }

    // Assigning someone to a dirty room starts the job.
    const start = cur.hk_status === "dirty" && staffId ? 1 : 0;
    const cleanNotes = String(notes || "").slice(0, 255);
    await pool.query(
      `UPDATE room_housekeeping
       SET assigned_to = ?, rush = ?, notes = ?,
           hk_status = IF(?, 'in-progress', hk_status),
           status_changed_at = IF(?, NOW(), status_changed_at)
       WHERE unit_id = ?`,
      [staffId, rush ? 1 : 0, cleanNotes, start, start, unitId]
    );
    if (start) {
      await pool.query(
        "INSERT INTO housekeeping_logs (room_id, unit_id, staff_id, status_from, status_to, notes) VALUES (?, ?, ?, 'dirty', 'in-progress', ?)",
        [cur.room_id, unitId, req.userId, cleanNotes || null]
      );
    }
    res.json(await getHkRoom(unitId));
  }));

  /* ------------------------------ housekeeping staff (users) ------------------------------ */

  router.get("/housekeepers", h(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT user_id AS id, TRIM(CONCAT(first_name, ' ', last_name)) AS name, email
       FROM users WHERE role = 'housekeeping' AND is_active = 1 ORDER BY first_name, last_name`
    );
    res.json(rows);
  }));

  router.post("/housekeepers", h(async (req, res) => {
    const { fullName = "", email = "", password = "" } = req.body || {};
    if (!String(fullName).trim()) throw new ApiError(400, "Enter the full name.");
    if (!EMAIL.test(email)) throw new ApiError(400, "Enter a valid email address.");
    if (String(password).length < 8) throw new ApiError(400, "Use a password of at least 8 characters.");

    const mail = email.toLowerCase();
    const [[dup]] = await pool.query("SELECT user_id FROM users WHERE email = ?", [mail]);
    if (dup) throw new ApiError(409, "An account with this email already exists.");

    const { first, last } = splitName(fullName);
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      "INSERT INTO users (role, first_name, last_name, email, password_hash) VALUES ('housekeeping', ?, ?, ?, ?)",
      [first, last, mail, hash]
    );
    res.status(201).json({ id: r.insertId, name: `${first} ${last}`.trim(), email: mail });
  }));

  router.delete("/housekeepers/:id", h(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new ApiError(400, "Invalid staff member.");
    const [result] = await pool.query(
      "UPDATE users SET is_active = 0 WHERE user_id = ? AND role = 'housekeeping'",
      [id]
    );
    if (!result.affectedRows) throw new ApiError(404, "Staff member not found.");
    await pool.query("UPDATE room_housekeeping SET assigned_to = NULL WHERE assigned_to = ?", [id]);
    res.json({ ok: true });
  }));

  /* ------------------------------ settings ------------------------------ */

  router.get("/settings", h(async (_req, res) => {
    res.json(await loadSettings());
  }));

  router.put("/settings", h(async (req, res) => {
    const body = req.body || {};
    const entries = [];
    for (const key of Object.keys(body)) {
      if (key in SETTING_FIELDS) entries.push([key, JSON.stringify(coerceSetting(key, body[key]))]);
    }
    if (entries.length) {
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES ?
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [entries]
      );
    }
    res.json(await loadSettings());
  }));

  // Known errors become clean JSON; everything else falls through to your global handler.
  router.use((err, _req, res, next) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That room number is already in use." });
    next(err);
  });

  return router;
}