const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendBadRequest } = require("../utils/http");

const router = express.Router();

router.post("/admin/departments", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || typeof name !== "string") return sendBadRequest(res, "name is required");

    await pool.query("INSERT INTO departments (name, description) VALUES (?, ?)", [
      name.trim(),
      description || null,
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/categories", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { department_id, parent_id, name, description } = req.body || {};
    if (!department_id || !name) return sendBadRequest(res, "department_id and name are required");

    await pool.query("INSERT INTO categories (department_id, parent_id, name, description) VALUES (?, ?, ?, ?)", [
      Number(department_id),
      parent_id ? Number(parent_id) : null,
      String(name).trim(),
      description || null,
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { category_id, title, description, price, is_published } = req.body || {};
    if (!category_id || !title || !description) {
      return sendBadRequest(res, "category_id, title, description are required");
    }

    await pool.query(
      `INSERT INTO courses (category_id, title, description, price, is_published)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(category_id),
        String(title).trim(),
        String(description),
        price != null ? Number(price) : 0,
        is_published === false ? false : true,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT id, title, category_id FROM courses ORDER BY id DESC LIMIT 500`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/admin/attributes", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { code, name } = req.body || {};
    if (!code || !name) return sendBadRequest(res, "code and name are required");

    await pool.query("INSERT INTO attributes (code, name) VALUES (?, ?)", [String(code).trim(), String(name).trim()]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/attribute-values", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { attribute_id, value } = req.body || {};
    if (!attribute_id || !value) return sendBadRequest(res, "attribute_id and value are required");

    await pool.query("INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)", [
      Number(attribute_id),
      String(value).trim(),
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
