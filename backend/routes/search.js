const express = require("express");
const jwt = require("jsonwebtoken");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { JWT_SECRET, readTokenFromRequest } = require("../config/security");
const { toIntOrNull } = require("../utils/http");

const router = express.Router();

router.post("/search/log", async (req, res) => {
  try {
    const token = readTokenFromRequest(req);
    let userId = null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        const uid = Number(payload.sub);
        if (Number.isFinite(uid)) userId = uid;
      } catch {
      }
    }

    const query = String((req.body || {}).query || "").trim();
    if (!query) return res.json({ ok: true });
    if (query.length > 120) return res.status(400).json({ error: "Query too long" });

    const context = String((req.body || {}).context || "catalog").trim().slice(0, 40);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 255);
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 64);

    await pool.query(
      `INSERT INTO search_events (user_id, query_text, context, user_agent, ip)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, query, context || "catalog", userAgent, ip]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Search log failed" });
  }
});

router.get("/search/popular", async (req, res) => {
  try {
    const limitRaw = toIntOrNull(req.query.limit) ?? 10;
    const limit = Math.max(1, Math.min(24, limitRaw));
    const halfLifeHours = 72;

    const [rows] = await pool.query(
      `SELECT
         query_text AS query,
         SUM(EXP(-TIMESTAMPDIFF(HOUR, created_at, NOW()) / ?)) AS score,
         COUNT(*) AS count
       FROM search_events
       WHERE created_at >= (NOW() - INTERVAL 90 DAY)
       GROUP BY query_text
       ORDER BY score DESC
       LIMIT ?`,
      [halfLifeHours, limit]
    );

    return res.json({
      popular: rows.map((r) => ({ query: r.query, score: Number(r.score), count: Number(r.count) })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Popular searches failed" });
  }
});

router.get("/me/recommendations", requireAuth, async (req, res) => {
  try {
    const limitRaw = toIntOrNull(req.query.limit) ?? 8;
    const limit = Math.max(1, Math.min(24, limitRaw));
    const userId = req.user.id;

    const [seedRows] = await pool.query(
      `(
        SELECT DISTINCT oi.course_id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = ? AND o.status = 'completed'
      )
      UNION
      (
        SELECT DISTINCT ci.course_id
        FROM carts c
        JOIN cart_items ci ON ci.cart_id = c.id
        WHERE c.user_id = ? AND c.status = 'active'
      )`,
      [userId, userId]
    );

    const seedIds = seedRows.map((r) => Number(r.course_id)).filter((x) => Number.isFinite(x));
    if (seedIds.length === 0) {
      const [fallback] = await pool.query(
        `SELECT id, title, description, price, created_at, creator_user_id
         FROM courses
         WHERE is_published = TRUE
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      return res.json(fallback);
    }

    const placeholders = seedIds.map(() => "?").join(",");

    const [excludeOwned] = await pool.query(
      `SELECT DISTINCT oi.course_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'completed'`,
      [userId]
    );
    const [excludeCart] = await pool.query(
      `SELECT DISTINCT ci.course_id
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       WHERE c.user_id = ? AND c.status = 'active'`,
      [userId]
    );
    const excludeIds = new Set([
      ...excludeOwned.map((r) => Number(r.course_id)),
      ...excludeCart.map((r) => Number(r.course_id)),
    ].filter((x) => Number.isFinite(x)));

    const [orderCop] = await pool.query(
      `SELECT
         oi2.course_id AS id,
         cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id,
         SUM(1) * 2.0 AS score
       FROM order_items oi1
       JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.course_id <> oi1.course_id
       JOIN courses cr ON cr.id = oi2.course_id
       JOIN orders o ON o.id = oi1.order_id
       WHERE o.user_id = ?
         AND o.status = 'completed'
         AND oi1.course_id IN (${placeholders})
         AND cr.is_published = TRUE
       GROUP BY oi2.course_id, cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id
       ORDER BY score DESC, cr.created_at DESC
       LIMIT ?`,
      [userId, ...seedIds, limit * 3]
    );

    const [cartCop] = await pool.query(
      `SELECT
         ci2.course_id AS id,
         cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id,
         SUM(1) * 0.8 AS score
       FROM carts c
       JOIN cart_items ci1 ON ci1.cart_id = c.id
       JOIN cart_items ci2 ON ci2.cart_id = c.id AND ci2.course_id <> ci1.course_id
       JOIN courses cr ON cr.id = ci2.course_id
       WHERE c.user_id = ?
         AND c.status = 'active'
         AND ci1.course_id IN (${placeholders})
         AND cr.is_published = TRUE
       GROUP BY ci2.course_id, cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id
       ORDER BY score DESC, cr.created_at DESC
       LIMIT ?`,
      [userId, ...seedIds, limit * 3]
    );

    const scoreMap = new Map();
    const put = (row) => {
      const id = Number(row.id);
      if (!Number.isFinite(id)) return;
      if (excludeIds.has(id)) return;
      const prev = scoreMap.get(id);
      const s = Number(row.score || 0);
      if (!prev) scoreMap.set(id, { ...row, score: s });
      else prev.score += s;
    };
    for (const r of orderCop) put(r);
    for (const r of cartCop) put(r);

    let merged = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    if (merged.length < limit) {
      const [seedCats] = await pool.query(`SELECT DISTINCT category_id FROM courses WHERE id IN (${placeholders})`, [
        ...seedIds,
      ]);
      const catIds = seedCats.map((r) => Number(r.category_id)).filter((x) => Number.isFinite(x));
      if (catIds.length > 0) {
        const catPh = catIds.map(() => "?").join(",");
        const [fill] = await pool.query(
          `SELECT id, title, description, price, created_at, creator_user_id
           FROM courses
           WHERE is_published = TRUE
             AND category_id IN (${catPh})
           ORDER BY created_at DESC
           LIMIT ?`,
          [...catIds, limit * 3]
        );
        const seen = new Set(merged.map((x) => Number(x.id)));
        for (const r of fill) {
          const id = Number(r.id);
          if (!Number.isFinite(id)) continue;
          if (excludeIds.has(id) || seen.has(id)) continue;
          merged.push(r);
          seen.add(id);
          if (merged.length >= limit) break;
        }
      }
    }

    merged = merged.map(({ score, ...rest }) => rest);
    return res.json(merged);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Personalized recommendations failed" });
  }
});

module.exports = router;
