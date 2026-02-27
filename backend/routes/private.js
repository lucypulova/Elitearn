const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

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
