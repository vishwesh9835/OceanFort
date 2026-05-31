const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const router = express.Router();

// Brute-force protection: track failed attempts per IP
const failMap = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15-minute lockout

// Constant-time string comparison — both values are padded to the same
// fixed length so length differences don't leak timing information.
function timingSafeEqual(a, b) {
  const sa = String(a).padEnd(256, "\0");
  const sb = String(b).padEnd(256, "\0");
  const bufA = Buffer.from(sa);
  const bufB = Buffer.from(sb);
  // Buffers must be the same byte-length for timingSafeEqual
  return crypto.timingSafeEqual(bufA, bufB) && sa.length === sb.length;
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

// Clean up expired lock entries every 30 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failMap) {
    // Remove if lock has expired AND there have been no recent failures
    if (entry.lockedUntil < now && entry.count === 0) failMap.delete(ip);
  }
}, 30 * 60 * 1000);
