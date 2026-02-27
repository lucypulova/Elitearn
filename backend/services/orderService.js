// Бизнес логика за изпълнение (fulfillment) на поръчка:
// - проверка на артикули/курсове
// - създаване/активиране на enrollments
// - логване на събития
// - имейли към купувач и продавачи (outbox + best-effort)

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const { sendMail } = require("../utils/mailer");
const { JWT_SECRET } = require("../config/security");
const { safeDownloadName } = require("../utils/http");

// Записва събитие към order_events (best-effort, да не чупи поръчката при проблем с логовете)
async function logOrderEvent(executor, orderId, eventType, message = null, meta = null) {
  try {
    await executor.query(
      `INSERT INTO order_events (order_id, event_type, message, meta)
       VALUES (?, ?, ?, ?)`,
      [orderId, eventType, message, meta ? JSON.stringify(meta) : null]
    );
  } catch (_) {
    // best-effort: не прекъсваме основния поток
  }
}

// Изпълнява поръчка: статуси, enrollments, материали, имейли
async function fulfillOrder(conn, { orderId, userId, userEmail, orderNumber }) {
  // 1) Старт: влизаме в етап проверка
  await conn.query("UPDATE orders SET status = 'stock_checking' WHERE id = ?", [orderId]);

  // 2) Вземаме артикулите от поръчката + проверка дали курсът е публикуван/наличен
  const [items] = await conn.query(
    `SELECT oi.course_id, oi.qty, cr.is_published
     FROM order_items oi
     LEFT JOIN courses cr ON cr.id = oi.course_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  // Ако поръчката няма артикули → cancel
  if (items.length === 0) {
    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    await logOrderEvent(conn, orderId, "ORDER_CANCELLED", "No items found for order", null);
    return { ok: false, code: 400, error: "Order has no items" };
  }

  // Ако има курс, който не е наличен/публикуван → cancel
  const bad = items.find((x) => x.is_published !== 1 && x.is_published !== true);
  if (bad) {
    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    await logOrderEvent(conn, orderId, "ELIGIBILITY_FAIL", "Course is not available", {
      course_id: bad.course_id,
    });
    return { ok: false, code: 409, error: "Някой от курсовете вече не е наличен." };
  }
  await logOrderEvent(conn, orderId, "ELIGIBILITY_OK", "All items eligible", { count: items.length });

  // 3) Маркираме, че започва fulfillment
  await conn.query("UPDATE orders SET status = 'fulfillment_pending' WHERE id = ?", [orderId]);

  // 4) Даваме достъп: създаваме/активираме enrollments (idempotent с ON DUPLICATE KEY)
  for (const it of items) {
    await conn.query(
      `INSERT INTO enrollments (user_id, course_id, order_id, status)
       VALUES (?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE status='active', order_id=VALUES(order_id)`,
      [userId, it.course_id, orderId]
    );
  }

  // 5) Завършване на поръчката
  await conn.query("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId]);
  await logOrderEvent(conn, orderId, "FULFILLED", "Enrollments granted", {
    granted_courses: items.map((x) => x.course_id),
  });

  // 6) Детайли за поръчката (за имейлите)
  const [orderInfoRows] = await conn.query(
    `SELECT o.id, o.order_number, o.created_at, o.total, o.full_name, o.phone
     FROM orders o
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  const orderInfo = orderInfoRows[0] || { order_number: orderNumber, total: null, created_at: null };

  // 7) Линии на поръчката + данни за продавач (creator)
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

  // 8) Материали по курсове (course_assets)
  const courseIds = [...new Set(lineRows.map((r) => Number(r.course_id)).filter((n) => Number.isFinite(n)))];
  const assetsByCourse = new Map();

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

  // Текстово описание на закупените курсове
  const linesText = lineRows
    .map((r) => {
      const qty = Number(r.qty || 0);
      const unit = Number(r.unit_price || 0);
      const line = Number(r.line_total || 0);
      return `• ${r.course_title} x${qty} — ${unit.toFixed(2)} EUR (общо ${line.toFixed(2)} EUR)`;
    })
    .join("\n");

  // 9) Генерираме временни download линкове (JWT token)
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  const tokenTtl = process.env.DOWNLOAD_TOKEN_TTL || "7d";

  const materialsLines = [];
  for (const courseId of courseIds) {
    const list = assetsByCourse.get(courseId) || [];
    if (list.length === 0) continue;

    const courseTitle =
      (lineRows.find((r) => Number(r.course_id) === Number(courseId)) || {}).course_title || `Курс #${courseId}`;

    materialsLines.push(`\n${courseTitle}:`);
    for (const a of list) {
      const t = jwt.sign({ assetId: a.id, userId }, JWT_SECRET, { expiresIn: tokenTtl });
      const link = `${baseUrl}/api/public/download/${encodeURIComponent(t)}`;
      materialsLines.push(`- ${a.title || `Файл #${a.id}`}: ${link}`);
    }
  }
  const materialsText = materialsLines.length > 0 ? materialsLines.join("\n") : "";

  // 10) Опит за прикачени файлове (с лимити за размер)
  const attachments = [];
  const MAX_TOTAL_ATTACH = 15 * 1024 * 1024;
  const MAX_SINGLE_ATTACH = 8 * 1024 * 1024;
  let totalAttach = 0;

  for (const courseId of courseIds) {
    const list = assetsByCourse.get(courseId) || [];
    for (const a of list) {
      try {
        const size = Number(a.file_size || 0);
        if (size <= 0) continue;
        if (size > MAX_SINGLE_ATTACH) continue;
        if (totalAttach + size > MAX_TOTAL_ATTACH) continue;

        const absPath = path.isAbsolute(a.file_path) ? a.file_path : path.join(__dirname, "..", a.file_path);
        if (!fs.existsSync(absPath)) continue;

        attachments.push({
          filename: safeDownloadName(a.title || `material_${a.id}`),
          path: absPath,
          contentType: a.mime_type || undefined,
        });
        totalAttach += size;
      } catch (_) {}
    }
  }

  // 11) Имейл към купувача (outbox + best-effort директно изпращане)
  const buyerSubject = `Потвърждение за покупка ${orderNumber}`;
  const buyerBody =
    `Здравей!\n\n` +
    `Потвърждаваме покупката ти.\n` +
    `Поръчка: ${orderNumber}\n` +
    (orderInfo.created_at ? `Дата: ${new Date(orderInfo.created_at).toLocaleString()}\n` : "") +
    (orderInfo.total != null ? `Сума: ${Number(orderInfo.total).toFixed(2)} EUR\n` : "") +
    `\nКурсове:\n${linesText}\n\n` +
    (materialsText ? `Линкове към материалите (валидни ограничено време):\n${materialsText}\n\n` : "") +
    (attachments.length > 0
      ? `Материалите са приложени като файлове към това писмо (брой: ${attachments.length}).\n`
      : `Материалите за курсовете са достъпни в сайта в секция „Моите курсове“.\n`) +
    `\nБлагодарим ти!\nElitearn`;

  try {
    await conn.query(
      `INSERT INTO notification_outbox (user_id, channel, to_addr, subject, body)
       VALUES (?, 'email', ?, ?, ?)`,
      [userId, userEmail, buyerSubject, buyerBody]
    );
  } catch (_) {}

  try {
    await sendMail({ to: userEmail, subject: buyerSubject, text: buyerBody, html: null, attachments });
    await logOrderEvent(conn, orderId, "EMAIL_SENT", "Buyer confirmation email sent", {
      to: userEmail,
      attachments: attachments.length,
    });
  } catch (e) {
    await logOrderEvent(conn, orderId, "EMAIL_SEND_FAIL", "Buyer email failed", {
      to: userEmail,
      error: e?.message || String(e),
    });
  }

  // 12) Имейли към продавачите (групиране по creator_user_id)
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

    try {
      await conn.query(
        `INSERT INTO notification_outbox (user_id, channel, to_addr, subject, body)
         VALUES (?, 'email', ?, ?, ?)`,
        [s.seller_id, s.seller_email, sellerSubject, sellerBody]
      );
    } catch (_) {}

    try {
      await sendMail({ to: s.seller_email, subject: sellerSubject, text: sellerBody });
      await logOrderEvent(conn, orderId, "SELLER_EMAIL_SENT", "Seller email sent", {
        to: s.seller_email,
        seller_id: s.seller_id,
      });
    } catch (e) {
      await logOrderEvent(conn, orderId, "SELLER_EMAIL_FAIL", "Seller email failed", {
        to: s.seller_email,
        error: e?.message || String(e),
      });
    }
  }

  return { ok: true, granted_courses: items.map((x) => x.course_id) };
}

module.exports = { logOrderEvent, fulfillOrder };