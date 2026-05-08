<h1 align="center">🌊 Oceanfort Hotel System</h1>

<p align="center">
  <strong>A Full-Stack Hotel Management & Booking Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-HTML5%2FCSS3%2FJS-blue" alt="Frontend">
  <img src="https://img.shields.io/badge/Backend-Node.js%20%26%20Express-green" alt="Backend">
  <img src="https://img.shields.io/badge/Database-SQLite-lightgrey" alt="Database">
</p>

Oceanfort is a complete web application built for boutique hotels. It features a modern customer-facing booking site and a secure admin dashboard to manage reservations and guest inquiries.

---

## ✨ Features

- 🏨 **Customer Portal**: Browse rooms, check availability, and make bookings seamlessly.
- 🛡️ **Secure Admin Dashboard**: JWT-protected panel for managing all operations.
- 📅 **Real-time Availability**: Prevents double-booking dynamically.
- 📩 **Contact Management**: Integrated system for handling guest inquiries.
- 📱 **Responsive Design**: Flawless experience across desktop and mobile devices.

## 📁 Project Architecture

The repository is structured to separate concerns and ensure maintainability:

```text
oceanfort/
├── public/           # Client-side UI (HTML, CSS, JS)
├── routes/           # Express API endpoints
├── middleware/       # JWT authentication & security
├── db/               # SQLite database configuration
├── server.js         # Application entry point
└── .env.example      # Environment variables template
```

## 🚀 Getting Started

Follow these steps to run Oceanfort locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v14+)

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Setup
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```
Update `.env` with your desired `ADMIN_USER`, `ADMIN_PASS`, and a secure `JWT_SECRET`.

### 3. Start the Server
Run the application in development mode:
```bash
npm start
```
- **Hotel site**: [http://localhost:3000](http://localhost:3000)
- **Admin panel**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

## 📡 API Reference

### Public Endpoints
- `POST /api/auth/login` - Admin authentication
- `POST /api/bookings/check` - Check room availability
- `POST /api/bookings` - Create a new booking
- `POST /api/contact` - Submit a contact inquiry

### Protected Endpoints (Requires Bearer Token)
- `GET /api/bookings` - Retrieve all bookings
- `PATCH /api/bookings/:id/status` - Update booking status
- `DELETE /api/bookings/:id` - Remove a booking
- `GET /api/contact` - Retrieve all messages
- `PATCH /api/contact/:id/status` - Mark message as read/unread
- `DELETE /api/contact/:id` - Remove a message

## 🛠️ Customization

To tailor the application for a specific hotel client:
- **Pricing & Rooms**: Edit the `PRICES` object in `routes/bookings.js`
- **Hotel Name**: Update the `HOTEL_NAME` variable in `.env`
- **Branding**: Modify `public/style.css` and replace `public/logo.jpg`

---

*Designed for high performance and immediate deployment.*
