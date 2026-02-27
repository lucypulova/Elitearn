const express = require("express");
const fs = require("fs");
const path = require("path");

const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendBadRequest } = require("../utils/http");
const { createUpload } = require("../config/uploads");

const upload = createUpload();
const router = express.Router();

router.post("/creator/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { category_id, title, description, price, is_private_lesson, contact_phone, contact_note } = req.body || {};
    if (!category_id || !title || !description) {
      return sendBadRequest(res, "category_id, title, description are required");
    }

    if (is_private_lesson) {
      const phone = (contact_phone || "").toString().trim();
      if (!phone) return sendBadRequest(res, "Моля, въведи телефон за връзка за частния урок.");
      const digits = phone.replace(/\D/g, "");
      const looksLikePhone = /^\+?[0-9()\-\s.]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
      if (!looksLikePhone) {
        return sendBadRequest(res, "Моля, въведи валиден телефонен номер (например +359 88 123 4567)." );
      }
    }

    const [ins] = await pool.query(
      `INSERT INTO courses (
         category_id, creator_user_id, title, description,
         contact_phone, contact_note, price, is_published, is_private_lesson
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(category_id),
        req.user.id,
        String(title).trim(),
        String(description),
        contact_phone ? String(contact_phone).trim() : null,
        contact_note ? String(contact_note).trim() : null,
        price != null ? Number(price) : 0,
        1,
        is_private_lesson ? 1 : 0,
      ]
    );

    res.status(201).json({ ok: true, course_id: ins.insertId });
  } catch (err) {
    next(err);
  }
});

router.get("/creator/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, category_id, price, is_published, is_private_lesson, contact_phone, contact_note, created_at
       FROM courses
       WHERE creator_user_id = ?
       ORDER BY id DESC
       LIMIT 500`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/creator/courses/:courseId/assets",
  requireAuth,
  requireRole("creator", "admin"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
      if (!req.file) return sendBadRequest(res, "file is required");

      const assetTitle = String(req.body?.title || req.file.originalname || "Material").trim();

      const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
        courseId,
        req.user.id,
      ]);
      if (ownerRows.length === 0) return res.status(403).json({ error: "Not owner of course" });

      const relPath = path.join("uploads", req.file.filename);

      const [ins] = await pool.query(
        `INSERT INTO course_assets (course_id, title, file_path, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [courseId, assetTitle, relPath, req.file.mimetype, req.file.size]
      );

      res.status(201).json({ ok: true, asset_id: ins.insertId });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/creator/assets/:assetId", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isFinite(assetId)) return sendBadRequest(res, "Invalid assetId");

    const [rows] = await pool.query(
      `SELECT a.id, a.course_id, a.file_path
       FROM course_assets a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = ? AND c.creator_user_id = ?
       LIMIT 1`,
      [assetId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: "Нямаш права да изтриеш този материал." });

    const asset = rows[0];
    await pool.query("DELETE FROM course_assets WHERE id = ?", [assetId]);

    try {
      const absPath = path.isAbsolute(asset.file_path)
        ? asset.file_path
        : path.join(__dirname, "..", asset.file_path);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (_) {}

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/creator/courses/:courseId/attribute-values",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");

      if (req.user.role !== "admin") {
        const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
          courseId,
          req.user.id,
        ]);
        if (ownerRows.length === 0) return res.status(403).json({ error: "Not owner of course" });
      }

      const [rows] = await pool.query(
        `SELECT
           av.id,
           av.attribute_id,
           a.name AS attribute_name,
           av.value
         FROM course_attribute_values cav
         JOIN attribute_values av ON av.id = cav.attribute_value_id
         JOIN attributes a ON a.id = av.attribute_id
         WHERE cav.course_id = ?
         ORDER BY a.name ASC, av.value ASC`,
        [courseId]
      );

      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/creator/courses/:courseId/attribute-values",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      const { attribute_value_id } = req.body || {};
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
      if (!attribute_value_id) return sendBadRequest(res, "attribute_value_id is required");

      if (req.user.role !== "admin") {
        const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
          courseId,
          req.user.id,
        ]);
        if (ownerRows.length === 0) return res.status(403).json({ error: "Not owner of course" });
      }

      await pool.query(
        `INSERT IGNORE INTO course_attribute_values (course_id, attribute_value_id)
         VALUES (?, ?)`,
        [courseId, Number(attribute_value_id)]
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/creator/courses/:courseId/attribute-values/:attributeValueId",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      const attributeValueId = Number(req.params.attributeValueId);
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
      if (!Number.isFinite(attributeValueId)) return sendBadRequest(res, "Invalid attributeValueId");

      if (req.user.role !== "admin") {
        const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
          courseId,
          req.user.id,
        ]);
        if (ownerRows.length === 0) return res.status(403).json({ error: "Not owner of course" });
      }

      await pool.query(
        `DELETE FROM course_attribute_values
         WHERE course_id = ? AND attribute_value_id = ?`,
        [courseId, attributeValueId]
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
