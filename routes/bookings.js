const express = require("express");
const router = express.Router();
const db = require("../db/database");
const requireAdmin = require("../middleware/auth");

const VALID_ROOM_TYPES = ["Deluxe Ocean", "Family Suite", "Garden Villa"];
const PRICES = { "Deluxe Ocean": 9900, "Family Suite": 14500, "Garden Villa": 18000 };
const VALID_GUESTS = ["1", "2", "3", "4+"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ADVANCE_DAYS = 365; // no bookings more than a year out

// Strict ISO 8601 date check (YYYY-MM-DD only) to avoid engine-specific parsing quirks
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function isValidDate(str) {
  if (!str || !ISO_DATE_RE.test(str)) return false;
  const d = new Date(str + "T00:00:00Z"); // force UTC parse
  return !isNaN(d.getTime());
}

function validateBookingDates(checkin, checkout) {
  if (!isValidDate(checkin) || !isValidDate(checkout))
    return "Invalid date format.";
  const cin = new Date(checkin);
  const cout = new Date(checkout);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (cin < now) return "Check-in cannot be in the past.";
  if (cin >= cout) return "Check-out must be after check-in.";
  const advanceDays = (cin - now) / 86400000;
  if (advanceDays > MAX_ADVANCE_DAYS) return `Bookings can only be made up to ${MAX_ADVANCE_DAYS} days in advance.`;
  const nights = Math.round((cout - cin) / 86400000);
  if (nights > 30) return "Maximum stay is 30 nights.";
  return null;
}

function checkConflict(room_type, checkin, checkout) {
  return db.prepare(`
    SELECT id FROM bookings
    WHERE room_type = ? AND status != 'cancelled'
      AND NOT (checkout <= ? OR checkin >= ?)
  `).get(room_type, checkin, checkout);
}

// POST /api/bookings/check — availability only, no save
router.post("/check", async (req, res, next) => {
  try {
    const { checkin, checkout, room_type } = req.body;

    if (!checkin || !checkout || !room_type)
      return res.status(400).json({ available: false, message: "Missing fields." });
    if (!VALID_ROOM_TYPES.includes(room_type))
      return res.status(400).json({ available: false, message: "Invalid room type." });

    const dateErr = validateBookingDates(checkin, checkout);
    if (dateErr) return res.status(400).json({ available: false, message: dateErr });

    const conflict = await checkConflict(room_type, checkin, checkout);
    if (conflict)
      return res.json({ available: false, message: `${room_type} is not available for those dates. Try different dates or room type.` });

    const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
    const pricePerNight = PRICES[room_type];
    return res.json({ available: true, nights, price_per_night: pricePerNight, total: pricePerNight * nights });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings — save confirmed booking
router.post("/", async (req, res, next) => {
  try {
    const { checkin, checkout, guests, room_type, name, email } = req.body;

    if (!checkin || !checkout || !guests || !room_type || !name || !email)
      return res.status(400).json({ success: false, message: "All fields are required." });
    if (!VALID_ROOM_TYPES.includes(room_type))
      return res.status(400).json({ success: false, message: "Invalid room type." });
    if (!VALID_GUESTS.includes(String(guests)))
      return res.status(400).json({ success: false, message: "Invalid guest count." });
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ success: false, message: "Invalid email address." });
    if (name.trim().length < 2 || name.trim().length > 100)
      return res.status(400).json({ success: false, message: "Name must be 2–100 characters." });

    const dateErr = validateBookingDates(checkin, checkout);
    if (dateErr) return res.status(400).json({ success: false, message: dateErr });

    const conflict = await checkConflict(room_type, checkin, checkout);
    if (conflict)
      return res.status(409).json({ success: false, message: `${room_type} was just booked. Please try different dates.` });

    const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
    const total = PRICES[room_type] * nights;

    const result = await db.prepare(`
      INSERT INTO bookings (checkin, checkout, guests, room_type, name, email, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(checkin, checkout, String(guests), room_type, name.trim(), email.trim().toLowerCase(), total);

    return res.status(201).json({
      success: true,
      message: `Booking confirmed for ${room_type}!`,
      booking_id: result.lastID,
      total
    });
  } catch (err) {
    next(err);
  }
}
});

// ── Admin-only routes ────────────────────────────────────────────────────────

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const data = await db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status." });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const r = await db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);
    if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const r = await db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, message: "Booking deleted." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
