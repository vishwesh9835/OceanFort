/**
 * Oceanfort Hotel - Main Script
 * Booking flow: Step 1 = check availability → Step 2 = modal (name+email) → confirm
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("navbar");
  const mobileToggle = document.getElementById("mobile-toggle");
  const navLinks = document.getElementById("nav-links");
  const fabBook = document.getElementById("fab-book");
  const yearSpan = document.getElementById("year");
  const bookingForm = document.getElementById("booking-form");

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // ── Set min dates for booking inputs ───────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  const checkinInput = document.getElementById("checkin");
  const checkoutInput = document.getElementById("checkout");

  if (checkinInput) {
    checkinInput.min = today;
    checkinInput.max = maxDateStr;
  }
  if (checkoutInput) {
    checkoutInput.min = today;
    checkoutInput.max = maxDateStr;
  }
  if (checkinInput) {
    checkinInput.addEventListener("change", () => {
      if (checkoutInput) {
        checkoutInput.min = checkinInput.value || today;
        // Auto-clear checkout if it's before the new checkin
        if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
          checkoutInput.value = "";
        }
      }
    });
  }

  // ── Navbar Scroll + FAB + Scroll-to-top ────────────────────────────────────
  const btnTop = document.getElementById("btn-top");
  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY > 50;
    navbar.classList.toggle("scrolled", scrolled);
    fabBook.classList.toggle("visible", scrolled);
    if (btnTop) btnTop.classList.toggle("visible", window.scrollY > 400);
  });
  if (btnTop) btnTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // ── Mobile Menu ────────────────────────────────────────────────────────────
  mobileToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");
    const spans = mobileToggle.querySelectorAll("span");
    spans[0].style.transform = isOpen ? "rotate(45deg) translate(5px, 6px)" : "none";
    spans[1].style.opacity = isOpen ? "0" : "1";
    spans[2].style.transform = isOpen ? "rotate(-45deg) translate(5px, -6px)" : "none";
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      mobileToggle.querySelectorAll("span").forEach((s) => { s.style.transform = "none"; s.style.opacity = "1"; });
    });
  });

  // ── Scroll Animations ──────────────────────────────────────────────────────
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("animate"); observer.unobserve(e.target); } }),
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );
  document.querySelectorAll(".fade-in-up, .reveal-left, .reveal-right").forEach((el) => observer.observe(el));

  // ── Toast ──────────────────────────────────────────────────────────────────
  window.showToast = function (message, type = "success") {
    const old = document.getElementById("toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "alert");
    t.setAttribute("aria-live", "polite");
    t.textContent = message;
    t.style.cssText = `
      position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:${type === "success" ? "#2d6a4f" : "#c0392b"};
      color:#fff;padding:1rem 2rem;border-radius:8px;z-index:9999;
      font-family:'Montserrat',sans-serif;font-size:0.9rem;
      box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:90vw;text-align:center;
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  };

  // ── STEP 1: Check Availability → open modal ────────────────────────────────
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const checkin = document.getElementById("checkin").value;
      const checkout = document.getElementById("checkout").value;
      const guests = document.getElementById("guests").value;
      const room_type = document.getElementById("roomtype").value;

      // Client-side date guard
      const now = new Date(); now.setHours(0, 0, 0, 0);
      if (new Date(checkin) < now) {
        showToast("Check-in cannot be in the past.", "error");
        return;
      }
      if (new Date(checkin) >= new Date(checkout)) {
        showToast("Check-out date must be after check-in date.", "error");
        return;
      }

      const btn = bookingForm.querySelector("button[type='submit']");
      const origText = btn.textContent;
      btn.textContent = "Checking…";
      btn.disabled = true;

      try {
        const res = await fetch("/api/bookings/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkin, checkout, room_type }),
        });
        const data = await res.json();

        if (data.available) {
          const { nights, price_per_night, total } = data;
          const fmt = (n) => "\u20b9" + Number(n).toLocaleString("en-IN");
          document.getElementById("modal-summary").textContent =
            `${room_type}  ·  ${nights} night${nights !== 1 ? "s" : ""}  ·  ${guests} guest${guests > 1 ? "s" : ""}  ·  ${checkin} \u2192 ${checkout}`;
          document.getElementById("modal-price").textContent =
            `${fmt(price_per_night)}/night  ×  ${nights}  =  ${fmt(total)} total`;
          document.getElementById("booking-modal").style.display = "flex";
          document.getElementById("modal-name").focus();
        } else {
          showToast(data.message || "Room not available.", "error");
        }
      } catch {
        showToast("Network error. Please try again.", "error");
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  // ── Contact Form ───────────────────────────────────────────────────────────
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = contactForm.querySelectorAll("input, select, textarea");
      const name = inputs[0].value.trim();
      const email = inputs[1].value.trim();
      const inquiry_type = inputs[2].value;
      const message = inputs[3].value.trim();

      // Client-side validation
      if (!name || !email || !message) {
        showToast("Please fill in all required fields.", "error");
        return;
      }
      if (!EMAIL_RE.test(email)) {
        showToast("Please enter a valid email address.", "error");
        return;
      }
      if (message.length < 10) {
        showToast("Message must be at least 10 characters.", "error");
        return;
      }

      const btn = contactForm.querySelector("button[type='submit']");
      const origText = btn.textContent;
      btn.textContent = "Sending…";
      btn.disabled = true;

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, inquiry_type, message }),
        });
        const data = await res.json();
        showToast(data.message, data.success ? "success" : "error");
        if (data.success) contactForm.reset();
      } catch {
        showToast("Network error. Please try again.", "error");
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  // ── Testimonial Slider ─────────────────────────────────────────────────────
  const slides = document.querySelectorAll(".testimonial-slide");
  const dotsContainer = document.getElementById("testimonial-dots");
  let currentSlide = 0, slideInterval;

  if (dotsContainer && slides.length > 0) {
    slides.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.classList.add("dot");
      if (i === 0) dot.classList.add("active");
      dot.dataset.index = i;
      dot.setAttribute("role", "button");
      dot.setAttribute("aria-label", `Slide ${i + 1}`);
      dot.setAttribute("tabindex", "0");
      dotsContainer.appendChild(dot);
    });
  }

  const dots = document.querySelectorAll(".dot");

  function showSlide(index) {
    slides.forEach((s) => s.classList.remove("active"));
    dots.forEach((d) => d.classList.remove("active"));
    slides[index].classList.add("active");
    if (dots[index]) dots[index].classList.add("active");
    currentSlide = index;
  }

  function startSlideShow() {
    clearInterval(slideInterval);
    if (slides.length > 1)
      slideInterval = setInterval(() => showSlide((currentSlide + 1) % slides.length), 5000);
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => { showSlide(parseInt(dot.dataset.index)); startSlideShow(); });
    dot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") dot.click(); });
  });
  if (slides.length > 0) startSlideShow();

  // ── Close modal on backdrop click / Escape key ─────────────────────────────
  const modal = document.getElementById("booking-modal");
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") closeModal();
    });
  }

  // ── Animated Stats Counter ─────────────────────────────────────────────────
  const statNumbers = document.querySelectorAll(".stat-number");
  if (statNumbers.length > 0) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const duration = 1800;
        const step = Math.ceil(target / (duration / 16));
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = current.toLocaleString("en-IN");
          if (current >= target) clearInterval(timer);
        }, 16);
        counterObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    statNumbers.forEach(el => counterObserver.observe(el));
  }

  // ── Property Tab Switching ─────────────────────────────────────────────────
  document.querySelectorAll(".prop-tab").forEach(tab => {
    tab.addEventListener("click", () => switchProperty(tab.dataset.city));
  });
});

// ── STEP 2: Confirm Booking (called from modal) ────────────────────────────
async function confirmBooking() {
  const nameEl = document.getElementById("modal-name");
  const emailEl = document.getElementById("modal-email");
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const btn = document.getElementById("modal-confirm-btn");

  if (!name) {
    showToast("Please enter your name.", "error");
    nameEl.focus();
    return;
  }

  if (!email) {
    showToast("Please enter your email.", "error");
    emailEl.focus();
    return;
  }

  if (!EMAIL_RE.test(email)) {
    showToast("Please enter a valid email address.", "error");
    emailEl.focus();
    return;
  }

  const checkin = document.getElementById("checkin").value;
  const checkout = document.getElementById("checkout").value;
  const guests = document.getElementById("guests").value;
  const room_type = document.getElementById("roomtype").value;

  const origText = btn.textContent;
  btn.textContent = "Confirming…";
  btn.disabled = true;

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin, checkout, guests, room_type, name, email }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid server response");
    }

    if (!res.ok) {
      throw new Error(data?.message || "Booking failed");
    }

    showToast(
      `🎉 Booking confirmed! Ref #${data.booking_id}. We'll contact you at ${email}.`,
      "success"
    );

    closeModal();
    document.getElementById("booking-form").reset();

  } catch (err) {
    showToast(err.message || "Network error. Please try again.", "error");
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

function closeModal() {
  const modal = document.getElementById("booking-modal");
  if (modal) {
    modal.style.display = "none";
    document.getElementById("modal-name").value = "";
    document.getElementById("modal-email").value = "";
  }
}

// Room card → pre-select room and scroll to booking bar
function selectRoom(type) {
  const roomSelect = document.getElementById("roomtype");
  if (roomSelect) {
    roomSelect.value = type;
    document.getElementById("booking-form").scrollIntoView({ behavior: "smooth" });
  }
}

// ── Property Tab Switching ─────────────────────────────────────────────────
function switchProperty(city) {
  document.querySelectorAll(".prop-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.city === city);
  });
  document.querySelectorAll(".prop-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `prop-${city}`);
  });
}
