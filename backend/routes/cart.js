const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendBadRequest } = require("../utils/http");
const { readCart, getOrCreateActiveCartId } = require("../services/cartService");

const router = express.Router();

router.get("/cart", requireAuth, async (req, res, next) => {
  try {
    res.json(await readCart(pool, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post("/cart/items", requireAuth, async (req, res, next) => {
  try {
    const { course_id, qty } = req.body || {};
    const courseId = Number(course_id);
    const q = qty == null ? 1 : Number(qty);

    if (!Number.isFinite(courseId)) return sendBadRequest(res, "course_id is required");
    if (!Number.isFinite(q) || q <= 0) return sendBadRequest(res, "qty must be > 0");

    const cartId = await getOrCreateActiveCartId(pool, req.user.id);

    const [courseRows] = await pool.query(
      "SELECT id, creator_user_id FROM courses WHERE id = ? AND is_published = TRUE",
      [courseId]
    );
    if (courseRows.length === 0) return res.status(404).json({ error: "Course not found" });

    if (Number(courseRows[0].creator_user_id) === Number(req.user.id)) {
      return res.status(409).json({ error: "Не можеш да купуваш курс, който ти си създала." });
    }

    const [enrRows] = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active' LIMIT 1",
      [req.user.id, courseId]
    );
    if (enrRows.length > 0) {
      return res.status(409).json({ error: "Вече сте закупили този курс." });
    }

    await pool.query(
      `INSERT INTO cart_items (cart_id, course_id, qty)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
      [cartId, courseId, q]
    );

    res.json(await readCart(pool, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.put("/cart/items/:courseId", requireAuth, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const q = Number((req.body || {}).qty);

    if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
    if (!Number.isFinite(q)) return sendBadRequest(res, "qty is required");

    const cartId = await getOrCreateActiveCartId(pool, req.user.id);

    if (q <= 0) {
      await pool.query("DELETE FROM cart_items WHERE cart_id = ? AND course_id = ?", [cartId, courseId]);
      return res.json(await readCart(pool, req.user.id));
    }

    await pool.query("UPDATE cart_items SET qty = ? WHERE cart_id = ? AND course_id = ?", [q, cartId, courseId]);
    res.json(await readCart(pool, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.delete("/cart/items/:courseId", requireAuth, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");

    const cartId = await getOrCreateActiveCartId(pool, req.user.id);
    await pool.query("DELETE FROM cart_items WHERE cart_id = ? AND course_id = ?", [cartId, courseId]);
    res.json(await readCart(pool, req.user.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
