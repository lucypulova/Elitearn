const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendBadRequest, safeDownloadName } = require("../utils/http");
const { JWT_SECRET } = require("../config/security");

const router = express.Router();

router.get("/courses/:courseId/private-info", requireAuth, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
    const userId = req.user.id;

    const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
      courseId,
      userId,
    ]);
    const isOwner = ownerRows.length > 0;

    const [enrRows] = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active' LIMIT 1",
      [userId, courseId]
    );
    const isEnrolled = enrRows.length > 0;
    if (!isOwner && !isEnrolled) return res.status(403).json({ error: "No access to this course" });

    const [rows] = await pool.query(
      "SELECT id, is_private_lesson, contact_phone, contact_note FROM courses WHERE id = ?",
      [courseId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Course not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/courses/:courseId/assets", requireAuth, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
    const userId = req.user.id;

    const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
      courseId,
      userId,
    ]);
    const isOwner = ownerRows.length > 0;

    const [enrRows] = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active' LIMIT 1",
      [userId, courseId]
    );
    const isEnrolled = enrRows.length > 0;
    if (!isOwner && !isEnrolled) return res.status(403).json({ error: "No access to this course" });

    const [assets] = await pool.query(
      "SELECT id, course_id, title, mime_type, file_size, created_at FROM course_assets WHERE course_id = ? ORDER BY id DESC",
      [courseId]
    );
    res.json(assets);
  } catch (err) {
    next(err);
  }
});

router.get("/assets/:assetId/download", requireAuth, async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isFinite(assetId)) return sendBadRequest(res, "Invalid assetId");

    const [rows] = await pool.query(
      "SELECT id, course_id, title, file_path, mime_type FROM course_assets WHERE id = ?",
      [assetId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Asset not found" });

    const asset = rows[0];
    const courseId = asset.course_id;
    const userId = req.user.id;

    const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
      courseId,
      userId,
    ]);
    const isOwner = ownerRows.length > 0;

    const [enrRows] = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active' LIMIT 1",
      [userId, courseId]
    );
    const isEnrolled = enrRows.length > 0;
    if (!isOwner && !isEnrolled) return res.status(403).json({ error: "No access to this file" });

    const absPath = path.isAbsolute(asset.file_path)
      ? asset.file_path
      : path.join(__dirname, "..", asset.file_path);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File missing on server" });

    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    res.download(absPath, safeDownloadName(asset.title || path.basename(absPath)));
  } catch (err) {
    next(err);
  }
});

router.get("/public/download/:token", async (req, res, next) => {
  try {
    const token = String(req.params.token || "");
    if (!token) return sendBadRequest(res, "Missing token");

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ error: "Invalid or expired link" });
    }

    const assetId = Number(payload?.assetId);
    const userId = Number(payload?.userId);
    if (!Number.isFinite(assetId) || !Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const [rows] = await pool.query(
      "SELECT id, course_id, title, file_path, mime_type FROM course_assets WHERE id = ?",
      [assetId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Asset not found" });

    const asset = rows[0];
    const courseId = asset.course_id;

    const [ownerRows] = await pool.query("SELECT id FROM courses WHERE id = ? AND creator_user_id = ?", [
      courseId,
      userId,
    ]);
    const isOwner = ownerRows.length > 0;

    const [enrRows] = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
      [userId, courseId]
    );
    const isEnrolled = enrRows.length > 0;
    if (!isOwner && !isEnrolled) return res.status(403).json({ error: "No access to this file" });

    const absPath = path.isAbsolute(asset.file_path)
      ? asset.file_path
      : path.join(__dirname, "..", asset.file_path);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File missing on server" });

    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    res.download(absPath, safeDownloadName(asset.title || path.basename(absPath)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
