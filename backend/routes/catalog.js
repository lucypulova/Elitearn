const express = require("express");
const { pool } = require("../db");
const { sendBadRequest, toIntOrNull, parseIdList } = require("../utils/http");

const router = express.Router();

router.get("/departments", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name, description FROM departments ORDER BY name");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (req, res, next) => {
  try {
    const departmentId = toIntOrNull(req.query.departmentId);

    if (departmentId) {
      const [rows] = await pool.query(
        `SELECT id, department_id, parent_id, name, description
         FROM categories
         WHERE department_id = ?
         ORDER BY parent_id IS NOT NULL, name`,
        [departmentId]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT id, department_id, parent_id, name, description
       FROM categories
       ORDER BY department_id, parent_id IS NOT NULL, name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/categories/roots", async (req, res, next) => {
  try {
    const departmentId = toIntOrNull(req.query.departmentId);
    if (!departmentId) return sendBadRequest(res, "departmentId is required");

    const [rows] = await pool.query(
      `SELECT id, department_id, parent_id, name, description
       FROM categories
       WHERE department_id = ? AND parent_id IS NULL
       ORDER BY name`,
      [departmentId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/attributes", async (req, res, next) => {
  try {
    const [attrs] = await pool.query("SELECT id, code, name FROM attributes ORDER BY name");
    const [vals] = await pool.query("SELECT id, attribute_id, value FROM attribute_values ORDER BY value");
    res.json(
      attrs.map((a) => ({
        ...a,
        values: vals.filter((v) => v.attribute_id === a.id),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/courses", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const departmentId = toIntOrNull(req.query.departmentId);
    const categoryId = toIntOrNull(req.query.categoryId);
    const sort = String(req.query.sort || "title_asc");
    const attrValueIds = parseIdList(req.query.attrValueIds);

    const sortSqlMapT = {
      price_asc: "t.price ASC, t.created_at DESC",
      price_desc: "t.price DESC, t.created_at DESC",
      title_asc: "t.title ASC",
      title_desc: "t.title DESC",
    };
    const sortSqlMapCr = {
      price_asc: "cr.price ASC, cr.created_at DESC",
      price_desc: "cr.price DESC, cr.created_at DESC",
      title_asc: "cr.title ASC",
      title_desc: "cr.title DESC",
    };
    const orderByT = sortSqlMapT[sort] || sortSqlMapT.title_asc;
    const orderByCr = sortSqlMapCr[sort] || sortSqlMapCr.title_asc;

    let baseSql = `
      SELECT
        cr.id, cr.title, cr.description, cr.price, cr.created_at,
        cr.creator_user_id,
        cr.category_id,
        c.name AS category_name,
        d.id AS department_id,
        d.name AS department_name
      FROM courses cr
      JOIN categories c ON c.id = cr.category_id
      JOIN departments d ON d.id = c.department_id
      WHERE cr.is_published = TRUE
    `;
    const params = [];

    if (q) {
      baseSql += ` AND (cr.title LIKE ? OR cr.description LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (departmentId) {
      baseSql += ` AND d.id = ?`;
      params.push(departmentId);
    }
    if (categoryId) {
      baseSql += `
        AND cr.category_id IN (
          SELECT id FROM categories
          WHERE id = ? OR parent_id = ?
        )
      `;
      params.push(categoryId, categoryId);
    }

    if (attrValueIds.length > 0) {
      const placeholders = attrValueIds.map(() => "?").join(",");
      const sql = `
        SELECT t.*
        FROM (${baseSql}) t
        JOIN course_attribute_values cav ON cav.course_id = t.id
        WHERE cav.attribute_value_id IN (${placeholders})
        GROUP BY t.id
        HAVING COUNT(DISTINCT cav.attribute_value_id) = ?
        ORDER BY ${orderByT}
        LIMIT 200
      `;
      const [rows] = await pool.query(sql, [...params, ...attrValueIds, attrValueIds.length]);
      return res.json(rows);
    }

    baseSql += ` ORDER BY ${orderByCr} LIMIT 200`;
    const [rows] = await pool.query(baseSql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/recommendations", async (req, res, next) => {
  try {
    const courseId = toIntOrNull(req.query.course_id);
    const limitRaw = toIntOrNull(req.query.limit) ?? 8;
    const limit = Math.max(1, Math.min(24, limitRaw));

    if (!courseId) {
      const [rows] = await pool.query(
        `SELECT id, title, description, price, created_at, creator_user_id
         FROM courses
         WHERE is_published = TRUE
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      return res.json(rows);
    }

    const [cop] = await pool.query(
      `SELECT
         oi2.course_id AS id,
         cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id,
         COUNT(*) AS score
       FROM order_items oi1
       JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.course_id <> oi1.course_id
       JOIN courses cr ON cr.id = oi2.course_id
       WHERE oi1.course_id = ?
         AND cr.is_published = TRUE
       GROUP BY oi2.course_id, cr.title, cr.description, cr.price, cr.created_at, cr.creator_user_id
       ORDER BY score DESC, cr.created_at DESC
       LIMIT ?`,
      [courseId, limit]
    );

    if (cop.length >= Math.min(4, limit)) {
      return res.json(cop.map(({ score, ...rest }) => rest));
    }

    const [sameCat] = await pool.query(
      `SELECT c.id, c.title, c.description, c.price, c.created_at, c.creator_user_id
       FROM courses c
       JOIN courses base ON base.id = ?
       WHERE c.is_published = TRUE
         AND c.id <> base.id
         AND c.category_id = base.category_id
       ORDER BY c.created_at DESC
       LIMIT ?`,
      [courseId, limit]
    );

    const seen = new Set();
    const merged = [];
    for (const r of cop.map(({ score, ...rest }) => rest)) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    }
    for (const r of sameCat) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
      if (merged.length >= limit) break;
    }

    return res.json(merged);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
