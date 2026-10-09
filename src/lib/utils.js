export const FEES_RATE = 0.15; // resort fees & taxes, share of room subtotal
export const SERVICE_FEE = 42; // flat service fee per booking

const pad = (n) => String(n).padStart(2, "0");

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  return new Date(`${iso}T00:00:00`);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const n = Math.round((parseISO(b) - parseISO(a)) / 864e5);
  return n > 0 ? n : 0;
}

export function formatDate(iso, opts = { month: "long", day: "numeric", year: "numeric" }) {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString("en-US", opts);
}

export function formatShortRange(a, b) {
  const s = parseISO(a);
  const e = parseISO(b);
  const sm = s.toLocaleDateString("en-US", { month: "short" });
  const em = e.toLocaleDateString("en-US", { month: "short" });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${sm} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${e.getFullYear()}`;
}

export function formatMoney(n) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcPricing(room, nights) {
  const subtotal = nights * room.price;
  const fees = Math.round(subtotal * FEES_RATE);
  const service = nights > 0 ? SERVICE_FEE : 0;
  return { subtotal, fees, service, total: subtotal + fees + service };
}

export function guestsLabel(adults, children) {
  const a = `${adults} Adult${adults !== 1 ? "s" : ""}`;
  if (!children) return a;
  return `${a}, ${children} ${children === 1 ? "Child" : "Children"}`;
}

export function rangesOverlap(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut; // ISO strings compare correctly
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 7; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `${new Date().getFullYear()}-${out}`;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message for a stay, or null if it's fine to book. */
export function stayIssue({ room, checkIn, checkOut, adults, children, available }) {
  if (!checkIn) return "Select a check-in date.";
  if (checkIn < todayISO()) return "Check-in can't be in the past.";
  if (!checkOut) return "Select a check-out date.";
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) return "Check-out must be after check-in.";
  if (nights < room.minNights) {
    return `This room requires a minimum stay of ${room.minNights} night${room.minNights > 1 ? "s" : ""}.`;
  }
  if (adults + children > room.maxGuests) {
    return `This room fits up to ${room.maxGuests} guests.`;
  }
  if (available === false) return "Sorry, this room is already booked for those dates.";
  return null;
}

export const getStatus = (r) =>
  r.cancelled ? "cancelled" : r.checkOut < todayISO() ? "completed" : "upcoming";

/** Free cancellation until 48h before 3 PM check-in; otherwise one night + taxes is charged. */
export function cancellationOutcome(r) {
  const start = parseISO(r.checkIn).getTime() + 15 * 36e5;
  const hours = (start - Date.now()) / 36e5;
  const free = hours >= 48;
  const nightRate = r.subtotal / r.nights;
  const charge = free ? 0 : Math.min(r.total, Math.round(nightRate * (1 + FEES_RATE)));
  return { free, charge, refund: r.total - charge };
}

export function downloadReceipt(r) {
  const lines = [
    "STAYEASE — BOOKING RECEIPT",
    "==========================",
    `Reference:   ${r.ref}`,
    `Guest:       ${r.guest.fullName} <${r.guest.email}>`,
    `Room:        ${r.roomName}`,
    `Check-in:    ${formatDate(r.checkIn)} (from 3:00 PM)`,
    `Check-out:   ${formatDate(r.checkOut)} (until 11:00 AM)`,
    `Nights:      ${r.nights}`,
    `Guests:      ${guestsLabel(r.adults, r.children)}`,
    "",
    `Room subtotal:        $${formatMoney(r.subtotal)}`,
    `Resort fees & taxes:  $${formatMoney(r.fees)}`,
    `Service fee:          $${formatMoney(r.service)}`,
    `TOTAL PAID:           $${formatMoney(r.total)}`,
    `Payment method:       ${r.paymentMethod}`,
    "",
    "Thank you for staying with StayEase.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stayease-receipt-${r.ref}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
