/**
 * Oceanfort Hotel – Production Test Suite
 * Run: npm test  (requires: npm install --save-dev jest supertest)
 */

"use strict";
// NOTE: paths are relative to tests/ — all project modules are one level up

process.env.NODE_ENV   = "test";
process.env.JWT_SECRET = "test-secret-for-jest-only-not-real";
process.env.ADMIN_USER = "testadmin";
process.env.ADMIN_PASS = "testpass";
process.env.HOTEL_NAME = "Test Hotel";
process.env.PORT       = "0";

const request = require("supertest");
const path    = require("path");

// ── Helpers ───────────────────────────────────────────────────────────────────
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// ── UNIT TESTS – ISO date regex ───────────────────────────────────────────────
describe("Unit: ISO date regex", () => {
  const valid   = ["2026-01-01", "2026-12-31", "2027-02-28"];
  const invalid = ["2026-1-1", "2026/01/01", "Jan 1 2026", "not-a-date", "", "2026-13-01", "2026-00-10"];
  valid.forEach(d   => it(`accepts ${d}`,    () => expect(ISO_DATE_RE.test(d)).toBe(true)));
  invalid.forEach(d => it(`rejects "${d}"`,  () => expect(ISO_DATE_RE.test(d)).toBe(false)));
});

// ── INTEGRATION SETUP ─────────────────────────────────────────────────────────
let app;
let adminToken;

beforeAll(async () => {
  jest.resetModules();
  const db      = require("../db/database");
  await db.init();

  const express = require("express");
  const pathMod = require("path");
  const rootDir = pathMod.join(__dirname, "..");
  const testApp = express();
  testApp.use(express.json({ limit: "10kb" }));
  testApp.use(express.urlencoded({ extended: true, limit: "10kb" }));
  testApp.use(express.static(pathMod.join(rootDir, "public")));
  testApp.use("/api/auth",     require("../routes/auth"));
  testApp.use("/api/bookings", require("../routes/bookings"));
  testApp.use("/api/contact",  require("../routes/contact"));
  testApp.get("/api/health",   (_, res) => res.json({ status: "ok" }));
  // eslint-disable-next-line no-unused-vars
  testApp.use((err, req, res, next) => res.status(500).json({ success: false, message: "Internal server error." }));
  app = testApp;
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("returns 400 if username or password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "admin" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for wrong credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "wronguser", password: "wrongpass" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 + JWT token for correct credentials", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ username: process.env.ADMIN_USER, password: process.env.ADMIN_PASS });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe("string");
    adminToken = res.body.token;
  });

  it("does not reveal whether username or password was wrong", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ username: process.env.ADMIN_USER, password: "wrongpass" });
    expect(res.body.message).toBe("Invalid credentials.");
  });
});

// ── BOOKINGS – Public ─────────────────────────────────────────────────────────
describe("POST /api/bookings/check (availability)", () => {
  const tomorrow = futureDate(1);
  const dayAfter = futureDate(2);

  it("returns 400 if required fields are missing", async () => {
    const res = await request(app).post("/api/bookings/check").send({ checkin: tomorrow });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid room type", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: tomorrow, checkout: dayAfter, room_type: "Penthouse Suite" });
    expect(res.status).toBe(400);
    expect(res.body.available).toBe(false);
  });

  it("returns 400 for check-in in the past", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: "2000-01-01", checkout: "2000-01-05", room_type: "Deluxe Ocean" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when checkout equals check-in", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: tomorrow, checkout: tomorrow, room_type: "Deluxe Ocean" });
    expect(res.status).toBe(400);
  });

  it("returns available:true for valid future dates", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: futureDate(30), checkout: futureDate(32), room_type: "Deluxe Ocean" });
    expect(res.body.available).toBe(true);
    expect(res.body.nights).toBe(2);
    expect(typeof res.body.total).toBe("number");
  });

  it("rejects dates more than 365 days in advance", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: futureDate(366), checkout: futureDate(368), room_type: "Deluxe Ocean" });
    expect(res.status).toBe(400);
  });

  it("rejects stays longer than 30 nights", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: futureDate(10), checkout: futureDate(42), room_type: "Deluxe Ocean" });
    expect(res.status).toBe(400);
  });

  it("rejects non-ISO date strings", async () => {
    const res = await request(app).post("/api/bookings/check")
      .send({ checkin: "Jan 5 2027", checkout: "Jan 10 2027", room_type: "Deluxe Ocean" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bookings (create booking)", () => {
  const cin  = futureDate(50);
  const cout = futureDate(52);

  it("returns 400 if any required field is missing", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, room_type: "Garden Villa" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, guests: "2", room_type: "Deluxe Ocean", name: "John Doe", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for name shorter than 2 chars", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, guests: "2", room_type: "Deluxe Ocean", name: "A", email: "j@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid guest value", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, guests: "10", room_type: "Deluxe Ocean", name: "John Doe", email: "j@example.com" });
    expect(res.status).toBe(400);
  });

  it("creates a booking and returns booking_id", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, guests: "2", room_type: "Deluxe Ocean", name: "John Doe", email: "john@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.booking_id).toBe("number");
  });

  it("returns 409 on a conflicting booking", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: cin, checkout: cout, guests: "1", room_type: "Deluxe Ocean", name: "Jane Smith", email: "jane@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ── BOOKINGS – Admin ──────────────────────────────────────────────────────────
describe("GET /api/bookings (admin)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a malformed token", async () => {
    const res = await request(app).get("/api/bookings").set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
  });

  it("returns booking list for a valid admin token", async () => {
    const res = await request(app).get("/api/bookings").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("PATCH /api/bookings/:id/status (admin)", () => {
  let bookingId;
  beforeAll(async () => {
    const res = await request(app).post("/api/bookings").send({
      checkin: futureDate(60), checkout: futureDate(62),
      guests: "1", room_type: "Family Suite", name: "Test User", email: "test@example.com"
    });
    bookingId = res.body.booking_id;
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).patch(`/api/bookings/${bookingId}/status`).send({ status: "confirmed" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await request(app).patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "approved" });
    expect(res.status).toBe(400);
  });

  it("confirms a booking successfully", async () => {
    const res = await request(app).patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "confirmed" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 for a non-numeric ID", async () => {
    const res = await request(app).patch("/api/bookings/abc/status")
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "confirmed" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a booking that does not exist", async () => {
    const res = await request(app).patch("/api/bookings/999999/status")
      .set("Authorization", `Bearer ${adminToken}`).send({ status: "cancelled" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/bookings/:id (admin)", () => {
  let deleteId;
  beforeAll(async () => {
    const res = await request(app).post("/api/bookings").send({
      checkin: futureDate(70), checkout: futureDate(72),
      guests: "1", room_type: "Garden Villa", name: "Delete Me", email: "del@example.com"
    });
    deleteId = res.body.booking_id;
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).delete(`/api/bookings/${deleteId}`);
    expect(res.status).toBe(401);
  });

  it("deletes a booking successfully", async () => {
    const res = await request(app).delete(`/api/bookings/${deleteId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 on second delete attempt", async () => {
    const res = await request(app).delete(`/api/bookings/${deleteId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── CONTACT ───────────────────────────────────────────────────────────────────
describe("POST /api/contact", () => {
  it("returns 400 if message is missing", async () => {
    const res = await request(app).post("/api/contact").send({ name: "Alice", email: "alice@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(app).post("/api/contact").send({ name: "Alice", email: "not-email", message: "Hello there!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a message shorter than 10 chars", async () => {
    const res = await request(app).post("/api/contact").send({ name: "Alice", email: "alice@example.com", message: "Hi" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a message longer than 2000 chars", async () => {
    const res = await request(app).post("/api/contact").send({ name: "Alice", email: "alice@example.com", message: "A".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("accepts unknown inquiry_type and defaults to General Inquiry", async () => {
    const res = await request(app).post("/api/contact")
      .send({ name: "Alice", email: "alice@example.com", inquiry_type: "HACK_ATTEMPT", message: "Hello, I have a question about your hotel." });
    expect(res.status).toBe(201);
  });

  it("submits a valid contact message", async () => {
    const res = await request(app).post("/api/contact")
      .send({ name: "Bob Jones", email: "bob@example.com", inquiry_type: "Feedback", message: "Great hotel, loved the ocean view!" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /api/contact (admin)", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/contact");
    expect(res.status).toBe(401);
  });

  it("returns all messages for a valid admin", async () => {
    const res = await request(app).get("/api/contact").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── SECURITY EDGE CASES ───────────────────────────────────────────────────────
describe("Security: request body size limit", () => {
  it("returns 413 for a JSON body larger than 10kb", async () => {
    const res = await request(app).post("/api/contact")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ name: "A".repeat(20000), email: "a@b.com", message: "x".repeat(20000) }));
    expect(res.status).toBe(413);
  });
});

describe("Security: SQL injection attempts", () => {
  it("handles SQL injection in email field — fails validation, not 500", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: futureDate(80), checkout: futureDate(82), guests: "1", room_type: "Deluxe Ocean",
               name: "Injector", email: "'; DROP TABLE bookings; --" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("handles SQL injection in name — parameterised query, never 500", async () => {
    const res = await request(app).post("/api/bookings")
      .send({ checkin: futureDate(83), checkout: futureDate(85), guests: "2", room_type: "Deluxe Ocean",
               name: "Robert'); DROP TABLE bookings;--", email: "safe@example.com" });
    expect([201, 400]).toContain(res.status);
  });
});

describe("API health endpoint", () => {
  it("returns status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
