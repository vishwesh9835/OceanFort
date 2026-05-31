const express = require("express");
const router = express.Router();
const db = require("../db/database");
const requireAdmin = require("../middleware/auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INQUIRY_TYPES = [
  "General Inquiry", "Room Information", "Special Requests",
  "Events & Weddings", "Dining", "Feedback", "Other"
];

router.post("/", async (req, res, next) => {
  try {
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

    await db.prepare("INSERT INTO contacts (name, email, inquiry_type, message) VALUES (?, ?, ?, ?)")
      .run(name.trim(), email.trim().toLowerCase(), resolvedType, message.trim());

    res.status(201).json({ success: true, message: "Message received! Our concierge will contact you within 24 hours." });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const data = await db.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["read", "unread"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status." });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const r = await db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, id);
    if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, message: "Updated." });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const r = await db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
    if (r.changes === 0) return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, message: "Deleted." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
