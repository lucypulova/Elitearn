const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendBadRequest } = require("../utils/http");
const { createUpload, UPLOADS_DIR } = require("../config/uploads");

const upload = createUpload();
const router = express.Router();

// GET /api/me/profile
router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, phone, billing_address, city, country, avatar_url, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        user_id: req.user.id,
        full_name: null,
        phone: null,
        billing_address: null,
        city: null,
        country: null,
        avatar_url: null,
        updated_at: null,
      });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/me/profile
router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const full_name = (req.body?.full_name ?? req.body?.fullName ?? "").toString().trim() || null;
    const phone = (req.body?.phone ?? "").toString().trim() || null;
    const billing_address = (req.body?.billing_address ?? req.body?.billingAddress ?? "").toString().trim() || null;
    const city = (req.body?.city ?? "").toString().trim() || null;
    const country = (req.body?.country ?? "").toString().trim() || null;

    await pool.query(
      `INSERT INTO user_profiles (user_id, full_name, phone, billing_address, city, country)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name=VALUES(full_name),
         phone=VALUES(phone),
         billing_address=VALUES(billing_address),
         city=VALUES(city),
         country=VALUES(country)`,
      [req.user.id, full_name, phone, billing_address, city, country]
    );

    const [rows] = await pool.query(
      `SELECT user_id, full_name, phone, billing_address, city, country, avatar_url, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/me/avatar
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res, next) => {
  try {
    if (!req.file) return sendBadRequest(res, "Missing avatar file");
    const avatarUrl = `/uploads/${req.file.filename}`;

    await pool.query(
      `INSERT INTO user_profiles (user_id, avatar_url)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE avatar_url=VALUES(avatar_url)`,
      [req.user.id, avatarUrl]
    );

    const [rows] = await pool.query(
      `SELECT user_id, full_name, phone, billing_address, city, country, avatar_url, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/me/avatar
router.delete("/avatar", requireAuth, async (req, res, next) => {
  try {
    const [rowsOld] = await pool.query(`SELECT avatar_url FROM user_profiles WHERE user_id = ?`, [req.user.id]);
    const oldUrl = rowsOld?.[0]?.avatar_url ? String(rowsOld[0].avatar_url) : null;
    if (!oldUrl) {
      return res.status(409).json({ error: "Няма качена профилна снимка за премахване." });
    }

    await pool.query(`UPDATE user_profiles SET avatar_url = NULL WHERE user_id = ?`, [req.user.id]);

    if (oldUrl.startsWith("/uploads/")) {
      const filename = oldUrl.replace("/uploads/", "");
      fs.unlink(path.join(UPLOADS_DIR, filename), () => {});
    }

    const [rows] = await pool.query(
      `SELECT user_id, full_name, phone, billing_address, city, country, avatar_url, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        user_id: req.user.id,
        full_name: null,
        phone: null,
        billing_address: null,
        city: null,
        country: null,
        avatar_url: null,
        updated_at: null,
      });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const current_password = String(req.body?.current_password || "");
    const new_password = String(req.body?.new_password || "");
    if (new_password.length < 6) return sendBadRequest(res, "Password must be at least 6 characters");

    const [rows] = await pool.query("SELECT id, password_hash FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/delete-account", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const password = String(req.body?.password || "");
    if (!password) return sendBadRequest(res, "Password is required");

    const userId = Number(req.user.id);
    const [uRows] = await conn.query("SELECT id, email, password_hash FROM users WHERE id = ?", [userId]);
    if (uRows.length === 0) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(password, uRows[0].password_hash);
    if (!ok) return res.status(400).json({ error: "Password is incorrect" });

    const [pRows] = await conn.query("SELECT avatar_url FROM user_profiles WHERE user_id = ?", [userId]);
    const avatarUrl = pRows?.[0]?.avatar_url ? String(pRows[0].avatar_url) : null;

    await conn.beginTransaction();

    const [oRows] = await conn.query(
      "SELECT COUNT(1) AS cnt FROM orders WHERE user_id = ? AND status IN ('completed','fulfilled','refunded')",
      [userId]
    );
    const hasOrders = Number(oRows?.[0]?.cnt || 0) > 0;

    await conn.query("DELETE FROM chat_conversations WHERE buyer_id = ? OR creator_id = ?", [userId, userId]);
    await conn.query("DELETE FROM notification_outbox WHERE user_id = ?", [userId]);
    await conn.query("UPDATE courses SET creator_user_id = NULL WHERE creator_user_id = ?", [userId]);
    await conn.query("DELETE FROM user_profiles WHERE user_id = ?", [userId]);
    await conn.query("UPDATE search_events SET user_id = NULL WHERE user_id = ?", [userId]);

    if (!hasOrders) {
      await conn.query("DELETE FROM users WHERE id = ?", [userId]);
      await conn.commit();
      if (avatarUrl && avatarUrl.startsWith("/uploads/")) {
        fs.unlink(path.join(UPLOADS_DIR, avatarUrl.replace("/uploads/", "")), () => {});
      }
      return res.json({ ok: true, mode: "deleted" });
    }

    const anonEmail = `deleted+${userId}_${Date.now()}@example.invalid`;
    const randomPass = crypto.randomBytes(32).toString("hex");
    const password_hash = await bcrypt.hash(randomPass, 10);
    await conn.query("UPDATE users SET email = ?, password_hash = ?, role = 'buyer' WHERE id = ?", [
      anonEmail,
      password_hash,
      userId,
    ]);

    await conn.commit();

    if (avatarUrl && avatarUrl.startsWith("/uploads/")) {
      fs.unlink(path.join(UPLOADS_DIR, avatarUrl.replace("/uploads/", "")), () => {});
    }
    return res.json({ ok: true, mode: "anonymized" });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
