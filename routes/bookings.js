const express      = require("express");
const router       = express.Router();
const db           = require("../db/database");
const requireAdmin = require("../middleware/auth");

const VALID_ROOM_TYPES = ["Deluxe Ocean", "Family Suite", "Garden Villa"];
const PRICES = { "Deluxe Ocean": 9900, "Family Suite": 14500, "Garden Villa": 18000 };
const VALID_GUESTS = ["1", "2", "3", "4+"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ADVANCE_DAYS = 365; // no bookings more than a year out

function isValidDate(str) {
  const d = new Date(str);
  return str && !isNaN(d.getTime());
}

function validateBookingDates(checkin, checkout) {
  if (!isValidDate(checkin) || !isValidDate(checkout))
    return "Invalid date format.";
  const cin  = new Date(checkin);
  const cout = new Date(checkout);
  const now  = new Date(); now.setHours(0, 0, 0, 0);
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
router.post("/check", (req, res) => {
  const { checkin, checkout, room_type } = req.body;

  if (!checkin || !checkout || !room_type)
    return res.status(400).json({ available: false, message: "Missing fields." });
  if (!VALID_ROOM_TYPES.includes(room_type))
    return res.status(400).json({ available: false, message: "Invalid room type." });

  const dateErr = validateBookingDates(checkin, checkout);
  if (dateErr) return res.status(400).json({ available: false, message: dateErr });

  if (checkConflict(room_type, checkin, checkout))
    return res.json({ available: false, message: `${room_type} is not available for those dates. Try different dates or room type.` });

  const nights        = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  const pricePerNight = PRICES[room_type];
  return res.json({ available: true, nights, price_per_night: pricePerNight, total: pricePerNight * nights });
});

// POST /api/bookings — save confirmed booking
router.post("/", (req, res) => {
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

  if (checkConflict(room_type, checkin, checkout))
    return res.status(409).json({ success: false, message: `${room_type} was just booked. Please try different dates.` });

  const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  const total  = PRICES[room_type] * nights;

  const result = db.prepare(`
    INSERT INTO bookings (checkin, checkout, guests, room_type, name, email, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(checkin, checkout, String(guests), room_type, name.trim(), email.trim().toLowerCase(), total);

  return res.status(201).json({
    success: true,
    message: `Booking confirmed for ${room_type}!`,
    booking_id: result.lastInsertRowid,
    total
  });
});

// ── Admin-only routes ────────────────────────────────────────────────────────

router.get("/", requireAdmin, (req, res) => {
  res.json({ success: true, data: db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all() });
});

router.patch("/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!["pending", "confirmed", "cancelled"].includes(status))
    return res.status(400).json({ success: false, message: "Invalid status." });
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
  const r = db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
  res.json({ success: true, message: `Status updated to ${status}.` });
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
  const r = db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
  res.json({ success: true, message: "Booking deleted." });
});

module.exports = router;
