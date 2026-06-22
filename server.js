require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://images.unsplash.com; " +
    "script-src 'self';"
  );
  next();
});

// ── CORS: restrict to same origin in production ─────────────────────────────
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: process.env.ALLOWED_ORIGIN || false }
  : { origin: true };
app.use(cors(corsOptions));

// ── Simple in-memory rate limiter for API routes ────────────────────────────
const rateMap = new Map();
function rateLimit(maxReqs, windowMs) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateMap.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    rateMap.set(key, entry);
    if (entry.count > maxReqs)
      return res.status(429).json({ success: false, message: "Too many requests. Please slow down." });
    next();
  };
}
// Clean up old rate-limit entries every 5 minutes
const RATE_WINDOW_MS = 60_000;
const MAX_RATELIMIT_ENTRIES = 10_000; // prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [k, v] of rateMap) if (v.start < cutoff) rateMap.delete(k);
  // Safety valve: if the map is still too large, evict oldest entries
  if (rateMap.size > MAX_RATELIMIT_ENTRIES) {
    const entries = [...rateMap.entries()].sort((a, b) => a[1].start - b[1].start);
    for (const [k] of entries.slice(0, rateMap.size - MAX_RATELIMIT_ENTRIES)) rateMap.delete(k);
  }
}, 5 * 60_000);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", rateLimit(10, 60_000), require("./routes/auth"));
app.use("/api/bookings", rateLimit(30, 60_000), require("./routes/bookings"));
app.use("/api/contact", rateLimit(10, 60_000), require("./routes/contact"));

app.get("/api/health", (_, res) => res.json({ status: "ok", hotel: process.env.HOTEL_NAME }));

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ── 404 handler for unmatched API routes (must be before SPA catch-all) ─────
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ── Startup guard: fail fast if critical env vars are missing ───────────────
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌊 ${process.env.HOTEL_NAME} running → http://localhost:${PORT}`);
    console.log(`📋 Admin → http://localhost:${PORT}/admin.html\n`);
  });
}).catch(err => {
  console.error("FATAL: Database initialization failed:", err);
  process.exit(1);
});
