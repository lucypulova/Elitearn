// Worker процес за изпращане на имейли от notification_outbox (outbox pattern)

require("dotenv").config();
const { pool } = require("./db");
const { sendMail } = require("./utils/mailer");

// Конфигурация на batch размера и интервала между изпълненията
const BATCH = Math.max(1, Math.min(50, Number(process.env.EMAIL_WORKER_BATCH || 10)));
const INTERVAL_MS = Math.max(1000, Number(process.env.EMAIL_WORKER_INTERVAL_MS || 4000));

// Генерира HTML версия от plain text (escape-ва специалните символи)
function asHtmlFromText(text) {
  const safe = String(text || "");
  const escaped = safe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<pre style="white-space: pre-wrap;">${escaped}</pre>`;
}

// Обработва един batch от pending имейли
async function processOnce() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Взимаме pending записи и ги заключваме
    const [rows] = await conn.query(
      `SELECT id, to_addr, subject, body
       FROM notification_outbox
       WHERE status = 'pending'
       ORDER BY id ASC
       LIMIT ?
       FOR UPDATE`,
      [BATCH]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return 0;
    }

    // Commit-ваме бързо, за да освободим lock-а
    await conn.commit();

    // Изпращаме извън транзакцията
    for (const m of rows) {
      try {
        await sendMail({
          to: m.to_addr,
          subject: m.subject,
          text: m.body,
          html: asHtmlFromText(m.body),
        });

        // Маркираме като изпратен
        await pool.query(
          `UPDATE notification_outbox
           SET status = 'sent', sent_at = NOW(), last_error = NULL
           WHERE id = ?`,
          [m.id]
        );
      } catch (err) {
        // При грешка → failed
        const msg = err?.message || String(err);

        await pool.query(
          `UPDATE notification_outbox
           SET status = 'failed', last_error = ?
           WHERE id = ?`,
          [msg.slice(0, 250), m.id]
        );

        console.error("Email send failed:", msg);
      }
    }

    return rows.length;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("Email worker error:", err?.message || err);
    return 0;
  } finally {
    conn.release();
  }
}

// Стартира worker-а в безкраен polling цикъл
async function main() {
  console.log("Email worker started. Provider:", String(process.env.EMAIL_PROVIDER || "mailtrap"));

  while (true) {
    await processOnce();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});