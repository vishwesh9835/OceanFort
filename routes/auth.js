const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const router = express.Router();

// Brute-force protection: track failed attempts per IP
const failMap = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15-minute lockout

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a).padEnd(64));
  const bufB = Buffer.from(String(b).padEnd(64));
  return crypto.timingSafeEqual(bufA, bufB) && a === b;
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const ip = req.ip;
  const entry = failMap.get(ip) || { count: 0, lockedUntil: 0 };

  if (Date.now() < entry.lockedUntil) {
    const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${mins} minute(s).`
    });
  }

  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: "Username and password are required." });

  const userOk = timingSafeEqual(username, process.env.ADMIN_USER);
  const passOk = timingSafeEqual(password, process.env.ADMIN_PASS);

  if (userOk && passOk) {
    failMap.delete(ip);
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return res.json({ success: true, token });
  }

  entry.count++;
  if (entry.count >= MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  failMap.set(ip, entry);

  setTimeout(() => {
    res.status(401).json({ success: false, message: "Invalid credentials." });
  }, 300);
});

module.exports = router;
