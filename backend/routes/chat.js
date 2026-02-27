const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/chat/conversations", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.body || {};
    const cid = Number(courseId);
    if (!Number.isFinite(cid) || cid <= 0) return res.status(400).json({ error: "Invalid courseId" });

    const [courseRows] = await pool.query("SELECT id, title, creator_user_id FROM courses WHERE id = ?", [cid]);
    if (courseRows.length === 0) return res.status(404).json({ error: "Course not found" });

    const creatorId = Number(courseRows[0].creator_user_id);
    if (!Number.isFinite(creatorId)) return res.status(409).json({ error: "This course has no creator assigned yet" });
    if (creatorId === req.user.id) {
      return res.status(409).json({ error: "You cannot start a chat about your own course" });
    }

    await pool.query(
      `INSERT INTO chat_conversations (course_id, buyer_id, creator_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [cid, req.user.id, creatorId]
    );

    const [convRows] = await pool.query(
      `SELECT id, course_id, buyer_id, creator_id, created_at, updated_at
       FROM chat_conversations
       WHERE course_id = ? AND buyer_id = ? AND creator_id = ?`,
      [cid, req.user.id, creatorId]
    );

    res.status(201).json({ ok: true, conversation: convRows[0] });
  } catch (err) {
    next(err);
  }
});

router.get("/chat/inbox", requireAuth, async (req, res, next) => {
  try {
    const uid = req.user.id;

    const [rows] = await pool.query(
      `SELECT
         cc.id,
         cc.course_id,
         cc.buyer_id,
         cc.creator_id,
         cc.created_at,
         cc.updated_at,
         cr.title AS course_title,
         u_b.email AS buyer_email,
         u_c.email AS creator_email,
         (SELECT cm.message FROM chat_messages cm WHERE cm.conversation_id = cc.id ORDER BY cm.id DESC LIMIT 1) AS last_message,
         (SELECT cm.created_at FROM chat_messages cm WHERE cm.conversation_id = cc.id ORDER BY cm.id DESC LIMIT 1) AS last_message_at,
         (SELECT COUNT(*) FROM chat_messages cm WHERE cm.conversation_id = cc.id AND cm.receiver_id = ? AND cm.is_read = 0) AS unread_count
       FROM chat_conversations cc
       JOIN courses cr ON cr.id = cc.course_id
       JOIN users u_b ON u_b.id = cc.buyer_id
       JOIN users u_c ON u_c.id = cc.creator_id
       WHERE cc.buyer_id = ? OR cc.creator_id = ?
       ORDER BY cc.updated_at DESC
       LIMIT 200`,
      [uid, uid, uid]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/chat/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const convId = Number(req.params.id);
    if (!Number.isFinite(convId) || convId <= 0) return res.status(400).json({ error: "Invalid id" });

    const [convRows] = await pool.query(
      `SELECT id, buyer_id, creator_id
       FROM chat_conversations
       WHERE id = ?`,
      [convId]
    );
    if (convRows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    const conv = convRows[0];
    if (conv.buyer_id !== req.user.id && conv.creator_id !== req.user.id) {
      return res.status(403).json({ error: "No access" });
    }

    await pool.query(
      `UPDATE chat_messages
       SET is_read = 1
       WHERE conversation_id = ? AND receiver_id = ?`,
      [convId, req.user.id]
    );

    const [msgs] = await pool.query(
      `SELECT id, conversation_id, sender_id, receiver_id, message, created_at, is_read
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY id ASC
       LIMIT 500`,
      [convId]
    );

    res.json(msgs);
  } catch (err) {
    next(err);
  }
});

router.post("/chat/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const convId = Number(req.params.id);
    const msg = String(req.body?.message || "").trim();
    if (!Number.isFinite(convId) || convId <= 0) return res.status(400).json({ error: "Invalid id" });
    if (!msg) return res.status(400).json({ error: "Message is required" });

    const [convRows] = await pool.query(
      `SELECT id, buyer_id, creator_id
       FROM chat_conversations
       WHERE id = ?`,
      [convId]
    );
    if (convRows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    const conv = convRows[0];
    if (conv.buyer_id !== req.user.id && conv.creator_id !== req.user.id) {
      return res.status(403).json({ error: "No access" });
    }

    const receiverId = req.user.id === conv.buyer_id ? conv.creator_id : conv.buyer_id;

    const [ins] = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, message)
       VALUES (?, ?, ?, ?)`,
      [convId, req.user.id, receiverId, msg]
    );

    await pool.query(`UPDATE chat_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id = ?`, [convId]);

    const [rows] = await pool.query(
      `SELECT id, conversation_id, sender_id, receiver_id, message, created_at, is_read
       FROM chat_messages
       WHERE id = ?`,
      [ins.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
