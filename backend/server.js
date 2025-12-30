// server.js (FULL - Stage 1/2/3 + Stripe Test Mode)
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const Stripe = require("stripe");
require("dotenv").config();
const { pool } = require("./db");
const { sendMail } = require("./utils/mailer");

const app = express();
app.use(cors());
app.use(express.json());

//Stripe config 
const PAYMENT_PROVIDER = String(process.env.PAYMENT_PROVIDER || "test").toLowerCase();
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_CURRENCY = String(process.env.STRIPE_CURRENCY || "EUR").toUpperCase();

const stripe =
  PAYMENT_PROVIDER === "stripe"
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
    : null;

///Uploads
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "file").replace(/[^\w.\-()+ ]/g, "_");
      cb(null, `${Date.now()}_${uuidv4()}_${safeName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

//Utils
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const sendBadRequest = (res, msg) => res.status(400).json({ error: msg });

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseIdList = (v) => {
  return String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
};

function safeDownloadName(name) {
  const base = String(name || "file").trim() || "file";
  return base.replace(/[^\w.\-()+ ]/g, "_");
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function readTokenFromRequest(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

function makeOrderNumber() {
  const yyyy = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 900000 + 100000);
  return `ORD-${yyyy}-${rnd}`;
}

function toCents(amount) {
  const n = Number(amount || 0);
  return Math.round(n * 100);
}

//Auth middleware
async function requireAuth(req, res, next) {
  try {
    const token = readTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const payload = jwt.verify(token, JWT_SECRET);
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) return res.status(401).json({ error: "Invalid token" });

    const [rows] = await pool.query("SELECT id, email, role, created_at FROM users WHERE id = ?", [
      userId,
    ]);
    if (rows.length === 0) return res.status(401).json({ error: "User not found" });

    req.user = rows[0];
    next();
  } catch (_) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

//Cart helpers
async function getOrCreateActiveCartId(executor, userId) {
  const [existing] = await executor.query(
    "SELECT id FROM carts WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [userId]
  );
  if (existing.length > 0) return existing[0].id;

  const [ins] = await executor.query("INSERT INTO carts (user_id, status) VALUES (?, 'active')", [
    userId,
  ]);
  return ins.insertId;
}

async function readCart(executor, userId) {
  const cartId = await getOrCreateActiveCartId(executor, userId);

  const [items] = await executor.query(
    `SELECT
        ci.course_id,
        ci.qty,
        cr.title,
        cr.price,
        (ci.qty * cr.price) AS line_total
     FROM cart_items ci
     JOIN courses cr ON cr.id = ci.course_id
     WHERE ci.cart_id = ?
     ORDER BY ci.id DESC`,
    [cartId]
  );

  const subtotal = items.reduce((s, it) => s + Number(it.line_total || 0), 0);
  return { cart_id: cartId, items, subtotal, total: subtotal };
}

//Pipeline helpers
async function logOrderEvent(executor, orderId, eventType, message = null, meta = null) {
  try {
    await executor.query(
      `INSERT INTO order_events (order_id, event_type, message, meta)
       VALUES (?, ?, ?, ?)`,
      [orderId, eventType, message, meta ? JSON.stringify(meta) : null]
    );
  } catch (_) {
  }
}

async function authorizePaymentTest({ amount, currency, orderNumber }) {
  const amountNum = Number(amount || 0);
  if (!(amountNum > 0)) {
    return { ok: false, provider: "test", intent_id: null, raw: { reason: "amount_must_be_positive" } };
  }

  const last = Number(String(orderNumber || "").slice(-1));
  const shouldFail = Number.isFinite(last) && last % 2 === 1 && amountNum > 100;
  if (shouldFail) {
    return { ok: false, provider: "test", intent_id: `test_fail_${Date.now()}`, raw: { reason: "simulated_decline" } };
  }

  return {
    ok: true,
    provider: "test",
    intent_id: `test_auth_${Date.now()}`,
    raw: { authorized: true, amount: amountNum, currency },
  };
}

async function fulfillOrder(conn, { orderId, userId, userEmail, orderNumber }) {
  //Eligibility
  await conn.query("UPDATE orders SET status = 'stock_checking' WHERE id = ?", [orderId]);

  const [items] = await conn.query(
    `SELECT oi.course_id, oi.qty, cr.is_published
     FROM order_items oi
     LEFT JOIN courses cr ON cr.id = oi.course_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  if (items.length === 0) {
    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    await logOrderEvent(conn, orderId, "ORDER_CANCELLED", "No items found for order", null);
    return { ok: false, code: 400, error: "Order has no items" };
  }

  const bad = items.find((x) => x.is_published !== 1 && x.is_published !== true);
  if (bad) {
    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    await logOrderEvent(conn, orderId, "ELIGIBILITY_FAIL", "Course is not available", { course_id: bad.course_id });
    return { ok: false, code: 409, error: "Някой от курсовете вече не е наличен." };
  }
  await logOrderEvent(conn, orderId, "ELIGIBILITY_OK", "All items eligible", { count: items.length });

  // Fulfillment 
  await conn.query("UPDATE orders SET status = 'fulfillment_pending' WHERE id = ?", [orderId]);

  for (const it of items) {
    await conn.query(
      `INSERT INTO enrollments (user_id, course_id, order_id, status)
       VALUES (?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE status='active', order_id=VALUES(order_id)`,
      [userId, it.course_id, orderId]
    );
  }

  await conn.query("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId]);
  await logOrderEvent(conn, orderId, "FULFILLED", "Enrollments granted", { granted_courses: items.map((x) => x.course_id) });

  // Email notifications (buyer + sellers)
  // Load full order context (titles, prices, creators, assets)
  const [orderInfoRows] = await conn.query(
    `SELECT o.id, o.order_number, o.created_at, o.total, o.full_name, o.phone
     FROM orders o
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  const orderInfo = orderInfoRows[0] || { order_number: orderNumber, total: null, created_at: null };

  const [lineRows] = await conn.query(
    `SELECT
       oi.course_id,
       oi.qty,
       oi.unit_price,
       oi.line_total,
       cr.title AS course_title,
       cr.creator_user_id,
       u.email AS creator_email
     FROM order_items oi
     JOIN courses cr ON cr.id = oi.course_id
     JOIN users u ON u.id = cr.creator_user_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const courseIds = [...new Set(lineRows.map((r) => Number(r.course_id)).filter((n) => Number.isFinite(n)))];
  let assetsByCourse = new Map();
  if (courseIds.length > 0) {
    const placeholders = courseIds.map(() => "?").join(",");
    const [assetRows] = await conn.query(
      `SELECT id, course_id, title, file_path, mime_type, file_size
       FROM course_assets
       WHERE course_id IN (${placeholders})
       ORDER BY course_id ASC, id ASC`,
      courseIds
    );
    for (const a of assetRows) {
      const k = Number(a.course_id);
      if (!assetsByCourse.has(k)) assetsByCourse.set(k, []);
      assetsByCourse.get(k).push(a);
    }
  }

  // Build buyer email
  const linesText = lineRows
    .map((r) => {
      const qty = Number(r.qty || 0);
      const unit = Number(r.unit_price || 0);
      const line = Number(r.line_total || 0);
      return `• ${r.course_title} x${qty} — ${unit.toFixed(2)} EUR (общо ${line.toFixed(2)} EUR)`;
    })
    .join("\n");


  // Build secure, time-limited download links for materials (works from email without login)
  const baseUrl =
    process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  const tokenTtl = process.env.DOWNLOAD_TOKEN_TTL || "7d";

  const materialsLines = [];
  for (const courseId of courseIds) {
    const list = assetsByCourse.get(courseId) || [];
    if (list.length === 0) continue;

    const courseTitle =
      (lineRows.find((r) => Number(r.course_id) === Number(courseId)) || {}).course_title ||
      `Курс #${courseId}`;

    materialsLines.push(`\n${courseTitle}:`);
    for (const a of list) {
      const t = jwt.sign({ assetId: a.id, userId }, JWT_SECRET, { expiresIn: tokenTtl });
      const link = `${baseUrl}/api/public/download/${encodeURIComponent(t)}`;
      materialsLines.push(`- ${a.title || `Файл #${a.id}`}: ${link}`);
    }
  }
  const materialsText = materialsLines.length > 0 ? materialsLines.join("\n") : "";

  const attachments = [];
  const MAX_TOTAL_ATTACH = 15 * 1024 * 1024; // 15MB total, best-effort
  const MAX_SINGLE_ATTACH = 8 * 1024 * 1024; // 8MB per file
  let totalAttach = 0;

  for (const courseId of courseIds) {
    const list = assetsByCourse.get(courseId) || [];
    for (const a of list) {
      try {
        const size = Number(a.file_size || 0);
        if (size <= 0) continue;
        if (size > MAX_SINGLE_ATTACH) continue;
        if (totalAttach + size > MAX_TOTAL_ATTACH) continue;

        const absPath = path.isAbsolute(a.file_path) ? a.file_path : path.join(__dirname, a.file_path);
        if (!fs.existsSync(absPath)) continue;

        attachments.push({
          filename: safeDownloadName(a.title || `material_${a.id}`),
          path: absPath,
          contentType: a.mime_type || undefined,
        });
        totalAttach += size;
      } catch (_) {
        // ignore attachment errors
      }
    }
  }

  const buyerSubject = `Потвърждение за покупка ${orderNumber}`;
  const buyerBody =
    `Здравей!\n\n` +
    `Потвърждаваме покупката ти.\n` +
    `Поръчка: ${orderNumber}\n` +
    (orderInfo.created_at ? `Дата: ${new Date(orderInfo.created_at).toLocaleString()}\n` : "") +
    (orderInfo.total != null ? `Сума: ${Number(orderInfo.total).toFixed(2)} EUR\n` : "") +
    `\nКурсове:\n${linesText}\n\n` +
    (materialsText
      ? `Линкове към материалите (валидни ограничено време):
${materialsText}

`
      : ``) +
    (attachments.length > 0
      ? `Материалите са приложени като файлове към това писмо (брой: ${attachments.length}).
`
      : `Материалите за курсовете са достъпни в сайта в секция „Моите курсове“.
`) +
    `\nБлагодарим ти!\nElitearn`;

  // Insert fallback outbox message for buyer
  try {
    await conn.query(
      `INSERT INTO notification_outbox (user_id, channel, to_addr, subject, body)
       VALUES (?, 'email', ?, ?, ?)`,
      [userId, userEmail, buyerSubject, buyerBody]
    );
  } catch (_) {}

  // Send buyer email immediately 
  try {
    await sendMail({
      to: userEmail,
      subject: buyerSubject,
      text: buyerBody,
      html: null,
      attachments,
    });
    await logOrderEvent(conn, orderId, "EMAIL_SENT", "Buyer confirmation email sent", { to: userEmail, attachments: attachments.length });
  } catch (e) {
    await logOrderEvent(conn, orderId, "EMAIL_SEND_FAIL", "Buyer email failed", { to: userEmail, error: e?.message || String(e) });
  }

  // Sellers: group items by creator
  const bySeller = new Map();
  for (const r of lineRows) {
    const sellerId = Number(r.creator_user_id);
    if (!bySeller.has(sellerId)) {
      bySeller.set(sellerId, { seller_id: sellerId, seller_email: r.creator_email, items: [] });
    }
    bySeller.get(sellerId).items.push(r);
  }

  for (const s of bySeller.values()) {
    const sellerLines = s.items
      .map((r) => {
        const qty = Number(r.qty || 0);
        const line = Number(r.line_total || 0);
        return `• ${r.course_title} x${qty} — ${line.toFixed(2)} EUR`;
      })
      .join("\n");

    const sellerSubject = `Нова покупка: ${orderNumber}`;
    const sellerBody =
      `Здравей!\n\n` +
      `Има нова покупка в Elitearn.\n` +
      `Поръчка: ${orderNumber}\n` +
      (orderInfo.created_at ? `Дата: ${new Date(orderInfo.created_at).toLocaleString()}\n` : "") +
      `Купувач: ${userEmail}\n` +
      `\nЗакупени курсове при теб:\n${sellerLines}\n\n` +
      `Elitearn`;

    // Insert fallback outbox message for seller
    try {
      await conn.query(
        `INSERT INTO notification_outbox (user_id, channel, to_addr, subject, body)
         VALUES (?, 'email', ?, ?, ?)`,
        [s.seller_id, s.seller_email, sellerSubject, sellerBody]
      );
    } catch (_) {}

    // Send immediately (best-effort)
    try {
      await sendMail({ to: s.seller_email, subject: sellerSubject, text: sellerBody });
      await logOrderEvent(conn, orderId, "SELLER_EMAIL_SENT", "Seller email sent", { to: s.seller_email, seller_id: s.seller_id });
    } catch (e) {
      await logOrderEvent(conn, orderId, "SELLER_EMAIL_FAIL", "Seller email failed", { to: s.seller_email, error: e?.message || String(e) });
    }
  }

  return { ok: true, granted_courses: items.map((x) => x.course_id) };
}

//Health
app.get("/api/health", (req, res) => res.json({ ok: true, provider: PAYMENT_PROVIDER }));

//AUTH
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    const desiredRole = String(role || "buyer");
    const allowedRoles = ["buyer", "creator"];
    const finalRole = allowedRoles.includes(desiredRole) ? desiredRole : "buyer";

    if (!e || !e.includes("@")) return sendBadRequest(res, "Valid email is required");
    if (p.length < 6) return sendBadRequest(res, "Password must be at least 6 characters");

    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [e]);
    if (exists.length > 0) return res.status(409).json({ error: "Email already registered" });

    const password_hash = await bcrypt.hash(p, 10);
    const [ins] = await pool.query("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)", [
      e,
      password_hash,
      finalRole,
    ]);

    const user = { id: ins.insertId, email: e, role: finalRole };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    if (!e || !p) return sendBadRequest(res, "email and password are required");

    const [rows] = await pool.query("SELECT id, email, password_hash, role FROM users WHERE email = ?", [e]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const userRow = rows[0];
    const ok = await bcrypt.compare(p, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const user = { id: userRow.id, email: userRow.email, role: userRow.role };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

app.get("/api/private/me", requireAuth, async (req, res) => res.json({ user: req.user }));

//Account profile
app.get("/api/me/profile", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, phone, billing_address, city, country, updated_at
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
        updated_at: null,
      });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put("/api/me/profile", requireAuth, async (req, res, next) => {
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
      `SELECT user_id, full_name, phone, billing_address, city, country, updated_at
       FROM user_profiles WHERE user_id = ?`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

//Catalog
app.get("/api/departments", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name, description FROM departments ORDER BY name");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/categories", async (req, res, next) => {
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

app.get("/api/categories/roots", async (req, res, next) => {
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

app.get("/api/attributes", async (req, res, next) => {
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

app.get("/api/courses", async (req, res, next) => {
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

//Recommendations
app.get("/api/recommendations", async (req, res, next) => {
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

//Course assets access
app.get("/api/courses/:courseId/private-info", requireAuth, async (req, res, next) => {
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

    const [rows] = await pool.query("SELECT id, is_private_lesson, contact_phone, contact_note FROM courses WHERE id = ?", [
      courseId,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Course not found" });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.get("/api/courses/:courseId/assets", requireAuth, async (req, res, next) => {
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

app.get("/api/assets/:assetId/download", requireAuth, async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isFinite(assetId)) return sendBadRequest(res, "Invalid assetId");

    const [rows] = await pool.query("SELECT id, course_id, title, file_path, mime_type FROM course_assets WHERE id = ?", [
      assetId,
    ]);
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

    const absPath = path.isAbsolute(asset.file_path) ? asset.file_path : path.join(__dirname, asset.file_path);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File missing on server" });

    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    res.download(absPath, safeDownloadName(asset.title || path.basename(absPath)));
  } catch (err) {
    next(err);
  }
});



// Public, time-limited download link (JWT token in URL).
// Used in purchase confirmation emails so buyers can download materials directly.
app.get("/api/public/download/:token", async (req, res, next) => {
  try {
    const token = String(req.params.token || "");
    if (!token) return sendBadRequest(res, "Missing token");

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired link" });
    }

    const assetId = Number(payload?.assetId);
    const userId = Number(payload?.userId);
    if (!Number.isFinite(assetId) || !Number.isFinite(userId)) return res.status(400).json({ error: "Invalid token payload" });

    const [rows] = await pool.query("SELECT id, course_id, title, file_path, mime_type FROM course_assets WHERE id = ?", [
      assetId,
    ]);
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

    const absPath = path.isAbsolute(asset.file_path) ? asset.file_path : path.join(__dirname, asset.file_path);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: "File missing on server" });

    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    res.download(absPath, safeDownloadName(asset.title || path.basename(absPath)));
  } catch (err) {
    next(err);
  }
});

//CART
app.get("/api/cart", requireAuth, async (req, res, next) => {
  try {
    const cart = await readCart(pool, req.user.id);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

app.post("/api/cart/items", requireAuth, async (req, res, next) => {
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

    // Prevent creators from buying their own courses
    if (Number(courseRows[0].creator_user_id) === Number(req.user.id)) {
      return res.status(409).json({ error: "Не можеш да купуваш курс, който ти си създала." });
    }

    // Prevent adding a course that the user already owns
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

app.put("/api/cart/items/:courseId", requireAuth, async (req, res, next) => {
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

app.delete("/api/cart/items/:courseId", requireAuth, async (req, res, next) => {
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

//ORDERS
// Create order (from cart)
app.post("/api/orders", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const full_name = (req.body?.customer?.full_name || "").trim() || null;
    const phone = (req.body?.customer?.phone || "").trim() || null;

    await conn.beginTransaction();

    const cartId = await getOrCreateActiveCartId(conn, userId);

    const [cartItems] = await conn.query(
      `SELECT ci.course_id, ci.qty, cr.price
       FROM cart_items ci
       JOIN courses cr ON cr.id = ci.course_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (cartItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Do not allow checkout of already owned courses (defense-in-depth)
    const courseIds = cartItems.map((x) => Number(x.course_id)).filter((n) => Number.isFinite(n));
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => "?").join(",");
      const [owned] = await conn.query(
        `SELECT course_id FROM enrollments WHERE user_id = ? AND status = 'active' AND course_id IN (${placeholders})`,
        [userId, ...courseIds]
      );
      if (owned.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "В кошницата има курс, който вече е закупен." });
      }
    }

    // Do not allow checkout of own courses (defense-in-depth)
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => "?").join(",");
      const [own] = await conn.query(
        `SELECT id FROM courses WHERE creator_user_id = ? AND id IN (${placeholders}) LIMIT 1`,
        [userId, ...courseIds]
      );
      if (own.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "В кошницата има курс, който е създаден от теб. Не можеш да го закупиш." });
      }
    }

    const orderNumber = makeOrderNumber();
    const subtotal = cartItems.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
    const total = subtotal;

    const [orderIns] = await conn.query(
      `INSERT INTO orders (order_number, user_id, status, full_name, phone, subtotal, total)
       VALUES (?, ?, 'created', ?, ?, ?, ?)`,
      [orderNumber, userId, full_name, phone, subtotal, total]
    );
    const orderId = orderIns.insertId;

    for (const it of cartItems) {
      const unit = Number(it.price);
      const qty = Number(it.qty);
      const line = unit * qty;

      await conn.query(
        `INSERT INTO order_items (order_id, course_id, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, it.course_id, unit, qty, line]
      );
    }

    await conn.query("UPDATE carts SET status = 'ordered' WHERE id = ?", [cartId]);
    await conn.query("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);

    await logOrderEvent(conn, orderId, "ORDER_CREATED", "Order created from cart", {
      cart_id: cartId,
      items: cartItems.map((x) => ({ course_id: x.course_id, qty: x.qty, price: x.price })),
    });

    await conn.commit();

    res.status(201).json({ ok: true, order_id: orderId, order_number: orderNumber, status: "created", subtotal, total });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

// Process order:
// - Stripe: create PaymentIntent (returns client_secret)
// - Test: authorize + fulfill immediately
app.post("/api/orders/:orderId/process", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return sendBadRequest(res, "Invalid orderId");

    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `SELECT id, order_number, user_id, status, total
       FROM orders
       WHERE id = ? FOR UPDATE`,
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

    if (order.user_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: "No access to this order" });
    }

    if (order.status === "completed") {
      await conn.rollback();
      return res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed" });
    }

    if (!["created", "payment_failed"].includes(order.status)) {
      await conn.rollback();
      return res.status(409).json({ error: `Order cannot be processed from status: ${order.status}` });
    }

    await conn.query("UPDATE orders SET status='payment_authorizing' WHERE id=?", [orderId]);
    await logOrderEvent(conn, orderId, "PAYMENT_AUTH_START", "Starting payment authorization", { provider: PAYMENT_PROVIDER });

    // STRIPE 
    if (PAYMENT_PROVIDER === "stripe") {
      if (!stripe || !STRIPE_SECRET_KEY) {
        await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Stripe not configured", null);
        await conn.commit();
        return res.status(500).json({ error: "Stripe not configured. Missing STRIPE_SECRET_KEY." });
      }

      const cents = toCents(order.total);
      // Allow free orders (total == 0). Stripe cannot create a PaymentIntent with amount 0,
      // so we bypass payment and fulfill immediately.
      if (cents < 0) {
        await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Total must be >= 0", { total: order.total });
        await conn.commit();
        return res.status(400).json({ error: "Invalid order total" });
      }

      if (cents === 0) {
        await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
        await conn.query(
          `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
           VALUES (?, ?, NULL, 'captured', ?, ?, JSON_OBJECT('free', true))`,
          [orderId, 'stripe', 0, STRIPE_CURRENCY]
        );
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_OK", "Free order (no payment required)", { total: order.total });

        const result = await fulfillOrder(conn, {
          orderId,
          userId,
          userEmail: req.user.email,
          orderNumber: order.order_number,
        });
        if (!result.ok) {
          await conn.commit();
          return res.status(result.code).json({ ok: false, error: result.error });
        }

        await conn.commit();
        return res.json({
          ok: true,
          provider: 'stripe',
          free: true,
          order_id: orderId,
          order_number: order.order_number,
          status: 'completed',
          granted_courses: result.granted_courses,
        });
      }

      // Create PaymentIntent (client confirms)
      const intent = await stripe.paymentIntents.create({
        amount: cents,
        currency: STRIPE_CURRENCY.toLowerCase(),
        payment_method_types: ["card"],
        description: `Order ${order.order_number}`,
        receipt_email: req.user.email || undefined,
        metadata: { order_id: String(orderId), order_number: order.order_number, user_id: String(userId) },
      });

      await conn.query(
        `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
         VALUES (?, 'stripe', ?, 'initiated', ?, ?, ?)`,
        [orderId, intent.id, Number(order.total || 0), STRIPE_CURRENCY, JSON.stringify(intent)]
      );

      await logOrderEvent(conn, orderId, "PAYMENT_INTENT_CREATED", "Stripe PaymentIntent created", { intent_id: intent.id });

      await conn.commit();

      return res.json({
        ok: true,
        provider: "stripe",
        order_id: orderId,
        order_number: order.order_number,
        status: "payment_authorizing",
        client_secret: intent.client_secret,
      });
    }

    // TEST 
    const pay = await authorizePaymentTest({ amount: order.total, currency: STRIPE_CURRENCY, orderNumber: order.order_number });

    await conn.query(
      `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        pay.provider,
        pay.intent_id,
        pay.ok ? "authorized" : "failed",
        Number(order.total || 0),
        STRIPE_CURRENCY,
        JSON.stringify(pay.raw || {}),
      ]
    );

    if (!pay.ok) {
      await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
      await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Payment declined (test)", pay.raw || null);
      await conn.commit();
      return res.status(402).json({ ok: false, status: "payment_failed", error: "Payment declined (simulated)" });
    }

    await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
    await logOrderEvent(conn, orderId, "PAYMENT_AUTH_OK", "Payment authorized (test)", { intent_id: pay.intent_id });

    const result = await fulfillOrder(conn, { orderId, userId, userEmail: req.user.email, orderNumber: order.order_number });
    if (!result.ok) {
      await conn.commit();
      return res.status(result.code).json({ ok: false, error: result.error });
    }

    await conn.commit();
    return res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed", granted_courses: result.granted_courses });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

// Stripe confirm: call after stripe.confirmCardPayment succeeds
app.post("/api/orders/:orderId/confirm", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    if (PAYMENT_PROVIDER !== "stripe") return res.status(400).json({ error: "Stripe is not enabled" });
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const userId = req.user.id;
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return sendBadRequest(res, "Invalid orderId");

    const payment_intent_id = String(req.body?.payment_intent_id || "").trim();
    if (!payment_intent_id) return sendBadRequest(res, "payment_intent_id is required");

    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `SELECT id, order_number, user_id, status, total
       FROM orders
       WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];
    if (order.user_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: "No access to this order" });
    }

    if (order.status === "completed") {
      await conn.rollback();
      return res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed" });
    }

    // Verify intent status from Stripe
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // We expect "succeeded" for confirmCardPayment with automatic capture
    if (intent.status !== "succeeded") {
      await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
      await conn.query(
        `UPDATE payments
         SET status='failed', raw_response=?
         WHERE order_id=? AND provider='stripe' AND intent_id=?
         ORDER BY id DESC LIMIT 1`,
        [JSON.stringify(intent), orderId, payment_intent_id]
      );
      await logOrderEvent(conn, orderId, "PAYMENT_CONFIRM_FAIL", "Stripe intent not succeeded", { status: intent.status });
      await conn.commit();
      return res.status(402).json({ ok: false, status: "payment_failed", error: `Stripe payment not succeeded: ${intent.status}` });
    }

    // Mark authorized/captured
    await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
    await conn.query(
      `UPDATE payments
       SET status='captured', raw_response=?
       WHERE order_id=? AND provider='stripe' AND intent_id=?
       ORDER BY id DESC LIMIT 1`,
      [JSON.stringify(intent), orderId, payment_intent_id]
    );
    await logOrderEvent(conn, orderId, "PAYMENT_CONFIRM_OK", "Stripe payment succeeded", { intent_id: intent.id });

    // Fulfill
    const result = await fulfillOrder(conn, { orderId, userId, userEmail: req.user.email, orderNumber: order.order_number });
    if (!result.ok) {
      await conn.commit();
      return res.status(result.code).json({ ok: false, error: result.error });
    }

    await conn.commit();
    res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed", granted_courses: result.granted_courses });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

// Buyer history
app.get("/api/me/orders", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, order_number, status, subtotal, total, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/me/courses", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT
        e.course_id,
        e.granted_at,
        cr.title,
        cr.description,
        cr.price,
        c.name AS category_name,
        d.name AS department_name
       FROM enrollments e
       JOIN courses cr ON cr.id = e.course_id
       JOIN categories c ON c.id = cr.category_id
       JOIN departments d ON d.id = c.department_id
       WHERE e.user_id = ? AND e.status = 'active'
       ORDER BY e.granted_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

//CREATOR: courses + upload materials
app.post("/api/creator/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const {
      category_id,
      title,
      description,
      price,
      is_private_lesson,
      contact_phone,
      contact_note,
    } = req.body || {};

    if (!category_id || !title || !description) return sendBadRequest(res, "category_id, title, description are required");

    // Phone validation for private lesson (server-side guard)
    if (is_private_lesson) {
      const phone = (contact_phone || "").toString().trim();
      if (!phone) {
        return sendBadRequest(res, "Моля, въведи телефон за връзка за частния урок.");
      }
      const digits = phone.replace(/\D/g, "");
      const looksLikePhone = /^\+?[0-9()\-\s.]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
      if (!looksLikePhone) {
        return sendBadRequest(res, "Моля, въведи валиден телефонен номер (например +359 88 123 4567).");
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
        1, // Always published right after creation
        is_private_lesson ? 1 : 0,
      ]
    );

    res.status(201).json({ ok: true, course_id: ins.insertId });
  } catch (err) {
    next(err);
  }
});

app.get("/api/creator/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
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

app.post(
  "/api/creator/courses/:courseId/assets",
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

// Creator can remove an uploaded material (asset) from own course
app.delete("/api/creator/assets/:assetId", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
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

    // Best-effort: delete the file from disk (ignore if missing)
    try {
      const absPath = path.isAbsolute(asset.file_path) ? asset.file_path : path.join(__dirname, asset.file_path);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (_) {
      // ignore filesystem errors
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* CATALOG MANAGEMENT (for course creators)
   NOTE: Endpoints kept under /admin/* for backward compatibility,
   but access is granted to users with role creator/admin. */
app.post("/api/admin/departments", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
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

app.post("/api/admin/categories", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
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

// Admin create-course endpoint (not used by the UI). Kept for compatibility.
app.post("/api/admin/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { category_id, title, description, price, is_published } = req.body || {};
    if (!category_id || !title || !description) return sendBadRequest(res, "category_id, title, description are required");

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

app.get("/api/admin/courses", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT id, title, category_id FROM courses ORDER BY id DESC LIMIT 500`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/attributes", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
  try {
    const { code, name } = req.body || {};
    if (!code || !name) return sendBadRequest(res, "code and name are required");

    await pool.query("INSERT INTO attributes (code, name) VALUES (?, ?)", [String(code).trim(), String(name).trim()]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/attribute-values", requireAuth, requireRole("creator", "admin"), async (req, res, next) => {
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

// Attribute assignment is now handled through creator endpoints (ownership check).

app.get(
  "/api/creator/courses/:courseId/attribute-values",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");

      // Ownership check (admins bypass)
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

app.post(
  "/api/creator/courses/:courseId/attribute-values",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      const { attribute_value_id } = req.body || {};
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
      if (!attribute_value_id) return sendBadRequest(res, "attribute_value_id is required");

      // Ownership check (admins bypass)
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

app.delete(
  "/api/creator/courses/:courseId/attribute-values/:attributeValueId",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      const attributeValueId = Number(req.params.attributeValueId);
      if (!Number.isFinite(courseId)) return sendBadRequest(res, "Invalid courseId");
      if (!Number.isFinite(attributeValueId)) return sendBadRequest(res, "Invalid attributeValueId");

      // Ownership check (admins bypass)
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

//Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});


//Chat (buyers can ask creators pre‑purchase)

// Create or get a conversation for a specific course.
// Any logged-in user may start a conversation with the course creator (pre‑purchase questions).
// Note: the DB column is named buyer_id for historical reasons; it stores the conversation initiator id.
app.post("/api/chat/conversations", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.body || {};
    const cid = Number(courseId);
    if (!Number.isFinite(cid) || cid <= 0) return res.status(400).json({ error: "Invalid courseId" });

    const [courseRows] = await pool.query(
      "SELECT id, title, creator_user_id FROM courses WHERE id = ?",
      [cid]
    );
    if (courseRows.length === 0) return res.status(404).json({ error: "Course not found" });

    const creatorId = Number(courseRows[0].creator_user_id);
    if (!Number.isFinite(creatorId)) return res.status(409).json({ error: "This course has no creator assigned yet" });
    if (creatorId === req.user.id) {
      return res.status(409).json({ error: "You cannot start a chat about your own course" });
    }

    // Try insert; if exists, fetch it
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

    return res.json({ conversation: convRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat: failed to create conversation" });
  }
});

// Inbox: list conversations for current user with last message + course title + other participant
app.get("/api/chat/inbox", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        c.id,
        c.course_id,
        c.buyer_id,
        c.creator_id,
        c.updated_at,
        crs.title AS course_title,
        CASE WHEN c.buyer_id = ? THEN u_creator.id ELSE u_buyer.id END AS other_user_id,
        CASE WHEN c.buyer_id = ? THEN u_creator.email ELSE u_buyer.email END AS other_user_email,
        CASE WHEN c.buyer_id = ? THEN u_creator.role ELSE u_buyer.role END AS other_user_role,
        m_last.id AS last_message_id,
        m_last.body AS last_message_body,
        m_last.created_at AS last_message_at,
        (
          SELECT COUNT(*)
          FROM chat_messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sender_id <> ?
            AND m2.read_at IS NULL
        ) AS unread_count
      FROM chat_conversations c
      JOIN courses crs ON crs.id = c.course_id
      JOIN users u_buyer ON u_buyer.id = c.buyer_id
      JOIN users u_creator ON u_creator.id = c.creator_id
      LEFT JOIN chat_messages m_last ON m_last.id = (
        SELECT m3.id
        FROM chat_messages m3
        WHERE m3.conversation_id = c.id
        ORDER BY m3.created_at DESC, m3.id DESC
        LIMIT 1
      )
      WHERE c.buyer_id = ? OR c.creator_id = ?
      ORDER BY c.updated_at DESC
      `,
      [userId, userId, userId, userId, userId, userId]
    );

    return res.json({ conversations: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat: failed to load inbox" });
  }
});

// Get messages in a conversation (must be participant)
app.get("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    if (!Number.isFinite(convId) || convId <= 0) return res.status(400).json({ error: "Invalid conversation id" });

    const userId = req.user.id;

    const [convRows] = await pool.query(
      "SELECT id, course_id, buyer_id, creator_id FROM chat_conversations WHERE id = ?",
      [convId]
    );
    if (convRows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    const conv = convRows[0];
    if (conv.buyer_id !== userId && conv.creator_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [msgRows] = await pool.query(
      `SELECT id, conversation_id, sender_id, body, created_at, read_at
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
      [convId]
    );

    // Mark as read all messages from the other user that are currently unread
    await pool.query(
      `UPDATE chat_messages
       SET read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = ?
         AND sender_id <> ?
         AND read_at IS NULL`,
      [convId, userId]
    );

    return res.json({ conversation: conv, messages: msgRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat: failed to load messages" });
  }
});

// Send a message (must be participant)
app.post("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    if (!Number.isFinite(convId) || convId <= 0) return res.status(400).json({ error: "Invalid conversation id" });

    const body = String((req.body || {}).body || "").trim();
    if (!body) return res.status(400).json({ error: "Message body is required" });
    if (body.length > 2000) return res.status(400).json({ error: "Message too long" });

    const userId = req.user.id;

    const [convRows] = await pool.query(
      "SELECT id, buyer_id, creator_id FROM chat_conversations WHERE id = ?",
      [convId]
    );
    if (convRows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    const conv = convRows[0];
    if (conv.buyer_id !== userId && conv.creator_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await pool.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)",
      [convId, userId, body]
    );

    await pool.query("UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convId]);

    const [msgRows] = await pool.query(
      `SELECT id, conversation_id, sender_id, body, created_at, read_at
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [convId]
    );

    return res.json({ message: msgRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat: failed to send message" });
  }
});

//Start
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port} (provider=${PAYMENT_PROVIDER})`));