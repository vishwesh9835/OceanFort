/**
 * Oceanfort Admin Dashboard – external script
 * Extracted from admin.html to satisfy Content-Security-Policy (no unsafe-inline).
 * All dynamic content is HTML-escaped before DOM insertion to prevent stored XSS.
 */

"use strict";

// ── HTML escaping helper (prevents stored XSS) ───────────────────────────────
function escHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let TOKEN = sessionStorage.getItem("of_token") || "";

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const u = document.getElementById("l-user").value.trim();
  const p = document.getElementById("l-pass").value;
  const btn = document.querySelector(".login-btn");
  btn.textContent = "Signing in…"; btn.disabled = true;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    const d = await res.json();
    if (d.success) {
      TOKEN = d.token;
      sessionStorage.setItem("of_token", TOKEN);
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").style.display = "block";
      loadOverview();
    } else {
      document.getElementById("login-err").textContent = d.message || "Invalid credentials.";
      document.getElementById("l-pass").value = "";
      document.getElementById("l-pass").focus();
    }
  } catch { document.getElementById("login-err").textContent = "Server error. Try again."; }
  btn.textContent = "Sign In"; btn.disabled = false;
}

// Allow Enter key to submit the login form
document.addEventListener("DOMContentLoaded", () => {
  const passInput = document.getElementById("l-pass");
  if (passInput) passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  const loginBtn = document.querySelector(".login-btn");
  if (loginBtn) loginBtn.addEventListener("click", doLogin);

  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Nav items
  document.querySelectorAll(".nav-item[data-section]").forEach(item => {
    item.addEventListener("click", () => nav(item.dataset.section, item));
  });

  // Refresh buttons
  const refreshBookings = document.querySelector("[data-action='refresh-bookings']");
  if (refreshBookings) refreshBookings.addEventListener("click", loadBookings);
  const refreshMessages = document.querySelector("[data-action='refresh-messages']");
  if (refreshMessages) refreshMessages.addEventListener("click", loadContacts);

  // Already logged in?
  if (TOKEN) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadOverview();
  }
});

function logout() {
  sessionStorage.removeItem("of_token"); TOKEN = "";
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("l-pass").value = "";
}

function authHdr() { return { "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN }; }

// ── NAV ──────────────────────────────────────────────────────────────────────
function nav(section, el) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("sec-" + section).classList.add("active");
  el.classList.add("active");
  const titles = { overview: "Overview", bookings: "Bookings", messages: "Messages" };
  document.getElementById("page-title").textContent = titles[section] || "";
  if (section === "bookings") loadBookings();
  if (section === "messages") loadContacts();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, err = false) {
  const t = document.getElementById("toast");
  t.textContent = escHtml(msg);
  t.style.background = err ? "#c0392b" : "#2d6a4f";
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 3500);
}

function badge(s) {
  const m = { pending: "b-pending", confirmed: "b-confirmed", cancelled: "b-cancelled", unread: "b-unread", read: "b-read" };
  const cls = m[s] || "";
  return `<span class="badge ${escHtml(cls)}">${escHtml(s)}</span>`;
}

function fmt(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [bR, cR] = await Promise.all([
      fetch("/api/bookings", { headers: authHdr() }),
      fetch("/api/contact",  { headers: authHdr() })
    ]);
    if (bR.status === 401 || cR.status === 401) { logout(); return; }
    const bks = (await bR.json()).data || [];
    const cts = (await cR.json()).data || [];

    document.getElementById("s-total").textContent     = bks.length;
    document.getElementById("s-confirmed").textContent = bks.filter(b => b.status === "confirmed").length;
    document.getElementById("s-pending").textContent   = bks.filter(b => b.status === "pending").length;
    document.getElementById("s-cancelled").textContent = bks.filter(b => b.status === "cancelled").length;
    document.getElementById("s-unread").textContent    = cts.filter(c => c.status === "unread").length;
    const revenue = bks.filter(b => b.status === "confirmed").reduce((a, b) => a + (b.total_price || 0), 0);
    document.getElementById("s-revenue").textContent   = fmt(revenue);

    document.getElementById("recent-body").innerHTML = bks.slice(0, 8).map(b => `
      <tr>
        <td>${escHtml(b.id)}</td><td>${escHtml(b.name || "—")}</td><td>${escHtml(b.room_type)}</td>
        <td>${escHtml(b.checkin)}</td><td>${escHtml(b.checkout)}</td>
        <td>${fmt(b.total_price)}</td><td>${badge(b.status)}</td>
      </tr>
    `).join("") || `<tr class="empty"><td colspan="7">No bookings yet.</td></tr>`;

    document.getElementById("last-up").textContent = "Updated: " + new Date().toLocaleTimeString();
  } catch (e) { toast("Failed to load data.", true); }
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
async function loadBookings() {
  const tb = document.getElementById("bookings-body");
  tb.innerHTML = `<tr class="empty"><td colspan="10">Loading…</td></tr>`;
  try {
    const res = await fetch("/api/bookings", { headers: authHdr() });
    if (res.status === 401) { logout(); return; }
    const data = (await res.json()).data || [];
    tb.innerHTML = data.length ? data.map(b => `
      <tr>
        <td>${escHtml(b.id)}</td><td>${escHtml(b.name || "—")}</td><td>${escHtml(b.email || "—")}</td>
        <td>${escHtml(b.room_type)}</td><td>${escHtml(b.checkin)}</td><td>${escHtml(b.checkout)}</td>
        <td>${escHtml(b.guests)}</td><td>${fmt(b.total_price)}</td><td>${badge(b.status)}</td>
        <td>
          ${b.status !== "confirmed" ? `<button class="ab ab-ok" data-id="${b.id}" data-action="confirm">✓</button>` : ""}
          ${b.status !== "cancelled" ? `<button class="ab ab-warn" data-id="${b.id}" data-action="cancel">✕</button>` : ""}
          <button class="ab ab-del" data-id="${b.id}" data-action="delete-booking">🗑</button>
        </td>
      </tr>`).join("") : `<tr class="empty"><td colspan="10">No bookings yet.</td></tr>`;

    // Attach event listeners (no inline onclick — avoids CSP issues)
    tb.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        if (action === "confirm")             updBook(id, "confirmed");
        else if (action === "cancel")         updBook(id, "cancelled");
        else if (action === "delete-booking") delBook(id);
      });
    });
  } catch { tb.innerHTML = `<tr class="empty"><td colspan="10">Failed to load.</td></tr>`; }
}

async function updBook(id, status) {
  const r = await fetch(`/api/bookings/${id}/status`, { method: "PATCH", headers: authHdr(), body: JSON.stringify({ status }) });
  const d = await r.json(); toast(d.message, !d.success); if (d.success) loadBookings();
}

async function delBook(id) {
  if (!confirm("Delete this booking permanently?")) return;
  const r = await fetch(`/api/bookings/${id}`, { method: "DELETE", headers: authHdr() });
  const d = await r.json(); toast(d.message, !d.success); if (d.success) loadBookings();
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
async function loadContacts() {
  const tb = document.getElementById("contacts-body");
  tb.innerHTML = `<tr class="empty"><td colspan="8">Loading…</td></tr>`;
  try {
    const res = await fetch("/api/contact", { headers: authHdr() });
    if (res.status === 401) { logout(); return; }
    const data = (await res.json()).data || [];
    tb.innerHTML = data.length ? data.map(c => {
      const nextStatus = c.status === "unread" ? "read" : "unread";
      const btnLabel   = c.status === "unread" ? "✓ Read" : "↩ Unread";
      return `
        <tr>
          <td>${escHtml(c.id)}</td><td>${escHtml(c.name)}</td><td>${escHtml(c.email)}</td>
          <td>${escHtml(c.inquiry_type)}</td>
          <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
              title="${escHtml(c.message)}">${escHtml(c.message)}</td>
          <td>${escHtml((c.created_at || "").split(" ")[0])}</td>
          <td>${badge(c.status)}</td>
          <td>
            <button class="ab ab-blue" data-id="${c.id}" data-action="toggle-contact" data-status="${nextStatus}">${escHtml(btnLabel)}</button>
            <button class="ab ab-del"  data-id="${c.id}" data-action="delete-contact">🗑</button>
          </td>
        </tr>`;
    }).join("") : `<tr class="empty"><td colspan="8">No messages yet.</td></tr>`;

    tb.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        if (action === "toggle-contact") updContact(id, btn.dataset.status);
        else if (action === "delete-contact") delContact(id);
      });
    });
  } catch { tb.innerHTML = `<tr class="empty"><td colspan="8">Failed to load.</td></tr>`; }
}

async function updContact(id, status) {
  const r = await fetch(`/api/contact/${id}/status`, { method: "PATCH", headers: authHdr(), body: JSON.stringify({ status }) });
  const d = await r.json(); toast(d.message, !d.success); if (d.success) loadContacts();
}

async function delContact(id) {
  if (!confirm("Delete this message permanently?")) return;
  const r = await fetch(`/api/contact/${id}`, { method: "DELETE", headers: authHdr() });
  const d = await r.json(); toast(d.message, !d.success); if (d.success) loadContacts();
}
