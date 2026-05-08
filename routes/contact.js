const express      = require("express");
const router       = express.Router();
const db           = require("../db/database");
const requireAdmin = require("../middleware/auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INQUIRY_TYPES = [
  "General Inquiry", "Room Information", "Special Requests",
  "Events & Weddings", "Dining", "Feedback", "Other"
];

router.post("/", (req, res) => {
  const { name, email, inquiry_type, message } = req.body;

  if (!name || !email || !message)
    return res.status(400).json({ success: false, message: "Name, email, and message are required." });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ success: false, message: "Invalid email address." });
  if (name.trim().length < 2 || name.trim().length > 100)
    return res.status(400).json({ success: false, message: "Name must be 2–100 characters." });
  if (message.trim().length < 10 || message.trim().length > 2000)
    return res.status(400).json({ success: false, message: "Message must be 10–2000 characters." });

  const resolvedType = VALID_INQUIRY_TYPES.includes(inquiry_type)
    ? inquiry_type
    : "General Inquiry";

  db.prepare("INSERT INTO contacts (name, email, inquiry_type, message) VALUES (?, ?, ?, ?)")
    .run(name.trim(), email.trim().toLowerCase(), resolvedType, message.trim());

  res.status(201).json({ success: true, message: "Message received! Our concierge will contact you within 24 hours." });
});

router.get("/",        requireAdmin, (req, res) => res.json({ success: true, data: db.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all() }));
router.patch("/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!["read","unread"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
  const r = db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, req.params.id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
  res.json({ success: true, message: "Updated." });
});
router.delete("/:id",  requireAdmin, (req, res) => {
  const r = db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
  res.json({ success: true, message: "Deleted." });
});

module.exports = router;
