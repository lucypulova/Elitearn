const express = require("express");

const { sendBadRequest } = require("../utils/http");
const { signToken } = require("../config/security");
const { requireAuth } = require("../middleware/auth");
const { pool } = require("../db");
const { registerUser, loginUser } = require("../services/authService");

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, role, full_name, phone, billing_address, city, country } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    if (!e || !e.includes("@")) return sendBadRequest(res, "Valid email is required");
    if (p.length < 6) return sendBadRequest(res, "Password must be at least 6 characters");

    const user = await registerUser({
      email: e,
      password: p,
      role,
      profile: {
        full_name: String(full_name || "").trim() || null,
        phone: String(phone || "").trim() || null,
        billing_address: String(billing_address || "").trim() || null,
        city: String(city || "").trim() || null,
        country: String(country || "").trim() || null,
      },
    });

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");
    if (!e || !p) return sendBadRequest(res, "email and password are required");

    const user = await loginUser({ email: e, password: p });
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// /api/auth/private/me (kept as /api/private/me via catalog router, but we also expose here)
router.get("/private/me", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.created_at,
              p.full_name, p.phone, p.billing_address, p.city, p.country, p.avatar_url, p.updated_at
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    const r = rows[0];
    res.json({
      user: { id: r.id, email: r.email, role: r.role },
      profile: {
        user_id: r.id,
        full_name: r.full_name ?? null,
        phone: r.phone ?? null,
        billing_address: r.billing_address ?? null,
        city: r.city ?? null,
        country: r.country ?? null,
        avatar_url: r.avatar_url ?? null,
        updated_at: r.updated_at ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
