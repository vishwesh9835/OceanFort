<h1 align="center"> Oceanfort Hotel </h1>

<p align="center">
  <strong>A Full-Stack Hotel Management &amp; Booking Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen" alt="Node.js">
  <img src="https://img.shields.io/badge/Backend-Express.js-black" alt="Express">
  <img src="https://img.shields.io/badge/Database-SQLite3%20(WAL)-lightgrey" alt="SQLite">
  <img src="https://img.shields.io/badge/Auth-JWT-orange" alt="JWT">
  <img src="https://img.shields.io/badge/Frontend-HTML5%2FCSS3%2FJS-blue" alt="Frontend">
</p>

Oceanfort is a complete web application for boutique hotels — a polished customer-facing booking site paired with a secure admin dashboard to manage reservations and guest inquiries.

---

## ✨ Features

- 🏨 **Customer Portal** — Browse rooms, check live availability, and confirm bookings
- 🛡️ **Secure Admin Dashboard** — JWT-protected panel with brute-force lockout
- 📅 **Real-time Conflict Detection** — Prevents double-bookings at the database level
- 📩 **Contact Management** — Integrated inquiry handling with read/unread tracking
- 🔒 **Security Hardened** — CSP headers, rate limiting, timing-safe auth, parameterised queries
- 📱 **Fully Responsive** — Works seamlessly on desktop and mobile

---

## 📁 Project Structure

```
oceanfort/
├── server.js              # Application entry point (Express + middleware setup)
├── package.json           # Dependencies & npm scripts
├── .env.example           # Environment variables template (copy → .env)
├── .gitignore
│
├── db/
│   └── database.js        # SQLite3 init, WAL mode, parameterised query helpers
│
├── middleware/
│   └── auth.js            # JWT verification middleware (requireAdmin)
│
├── routes/
│   ├── auth.js            # POST /api/auth/login (with brute-force lockout)
│   ├── bookings.js        # Booking CRUD + availability check
│   └── contact.js         # Contact form submission + admin management
│
├── public/                # Static frontend (served by Express)
│   ├── index.html         # Customer-facing hotel website
│   ├── script.js          # Frontend logic (booking flow, contact, animations)
│   ├── style.css          # All styling
│   ├── admin.html         # Admin dashboard shell
│   ├── admin.js           # Admin dashboard logic (CSP-compliant, XSS-safe)
│   ├── logo.png           # Hotel logo
│   └── robots.txt         # Blocks /admin.html and /api/ from search engines
│
└── tests/
    └── tests.js           # Jest + Supertest integration & unit test suite (51 tests)
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) **v18 or higher**

### 1. Clone & Install

```bash
git clone <your-repo-url> oceanfort
cd oceanfort
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

| Variable | Description |
|----------|-------------|
| `PORT` | Port to listen on (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `HOTEL_NAME` | Hotel display name |
| `ADMIN_USER` | Admin login username |
| `ADMIN_PASS` | Admin login password (use something strong) |
| `JWT_SECRET` | Random 32-byte hex string — generate with the command below |
| `ALLOWED_ORIGIN` | Your production domain (e.g. `https://www.oceanforthotel.com`) |

```bash
# Generate a secure JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run the Server

```bash
# Development (auto-restarts on file changes):
npm run dev

# Production:
npm start
```

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Customer hotel website |
| `http://localhost:3000/admin.html` | Admin dashboard |
| `http://localhost:3000/api/health` | Health check endpoint |

---

## 🧪 Running Tests

```bash
# Install test dependencies (first time only):
npm install --save-dev jest supertest

# Run all 51 tests:
npm test
```

Tests are in `tests/tests.js` and cover:
- Auth endpoint (login, wrong credentials, missing fields)
- Booking availability & conflict detection
- Full booking CRUD (create, confirm, cancel, delete)
- Contact form validation & admin management
- Security edge-cases (SQL injection, XSS payloads, oversized bodies)
- Admin route access control (401 without token, 401 with bad token)

---

## 📡 API Reference

### Public Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Admin login — returns JWT |
| `POST` | `/api/bookings/check` | Check room availability (no booking created) |
| `POST` | `/api/bookings` | Create a confirmed booking |
| `POST` | `/api/contact` | Submit a guest inquiry |
| `GET`  | `/api/health` | Server health check |

### Protected Endpoints *(require `Authorization: Bearer <token>`)*

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/bookings` | List all bookings |
| `PATCH` | `/api/bookings/:id/status` | Update status (`pending` / `confirmed` / `cancelled`) |
| `DELETE` | `/api/bookings/:id` | Permanently delete a booking |
| `GET` | `/api/contact` | List all contact messages |
| `PATCH` | `/api/contact/:id/status` | Mark message `read` / `unread` |
| `DELETE` | `/api/contact/:id` | Permanently delete a message |

---

## 🚢 Production Deployment

### Using PM2 + Nginx (recommended for Linux/VPS)

**1. Install PM2 and start the app:**
```bash
npm install --production
npm install -g pm2
pm2 start server.js --name "oceanfort"
pm2 startup   # generates a systemd/init script
pm2 save
```

**2. Nginx reverse-proxy config:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**3. Enable HTTPS (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t oceanfort:latest .
docker run -p 3000:3000 --env-file .env oceanfort:latest
```

### Monitoring & Logs

```bash
pm2 logs oceanfort       # live logs
pm2 monit                # dashboard
```

### Database Backup

```bash
# SQLite is a single file — back it up with:
cp db/oceanfort.db db/oceanfort.db.backup-$(date +%Y%m%d)
```

---

## 🛠️ Customisation

| What to change | Where |
|----------------|-------|
| Room types & prices | `routes/bookings.js` → `PRICES` and `VALID_ROOM_TYPES` |
| Hotel name | `HOTEL_NAME` in `.env` |
| Branding & colours | `public/style.css` |
| Logo | Replace `public/logo.png` |
| Admin credentials | `ADMIN_USER` / `ADMIN_PASS` in `.env` |

---

## 🔒 Security Notes

- All database queries use **parameterised statements** — no SQL injection possible
- Admin credentials compared with **`crypto.timingSafeEqual`** — no timing attacks
- Rate limiting: **10 req/min** on auth, **30 req/min** on bookings, **10 req/min** on contact
- Brute-force protection: **5 failed logins → 15-minute IP lockout**
- CSP, X-Frame-Options, HSTS, and other security headers set on every response
- JWT tokens expire after **8 hours**

---

*Oceanfort Hotel System — v2.1.0*
