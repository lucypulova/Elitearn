// worker_email.js
// Email delivery worker.
// Delivers messages from notification_outbox using an external provider.
// Supported providers:
//  - Mailtrap (SMTP): EMAIL_PROVIDER=mailtrap
//  - SendGrid (API):  EMAIL_PROVIDER=sendgrid

require("dotenv").config();
const { pool } = require("./db");
const { sendMail } = require("./utils/mailer");

const BATCH = Math.max(1, Math.min(50, Number(process.env.EMAIL_WORKER_BATCH || 10)));
const INTERVAL_MS = Math.max(1000, Number(process.env.EMAIL_WORKER_INTERVAL_MS || 4000));

function asHtmlFromText(text) {
  const safe = String(text || "");
  const escaped = safe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap;">${escaped}</pre>`;
}

async function processOnce() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, user_id, channel, to_addr, subject, body
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

    // The project DB schema defines outbox statuses: pending/sent/failed.
    // An earlier worker version attempted to set status='sending', which breaks
    // ENUM validation and prevents any emails from being delivered.
    // We keep rows locked in this transaction (FOR UPDATE) and commit quickly.
    await conn.commit();

    // Deliver outside the transaction.
    for (const m of rows) {
      try {
        await sendMail({
          to: m.to_addr,
          subject: m.subject,
          text: m.body,
          html: asHtmlFromText(m.body),
        });

        await pool.query(
          `UPDATE notification_outbox
           SET status = 'sent', sent_at = NOW(), last_error = NULL
           WHERE id = ?`,
          [m.id]
        );
      } catch (err) {
        const msg = err?.message || String(err);
        await pool.query(
          `UPDATE notification_outbox
           SET status = 'failed', last_error = ?
           WHERE id = ?`,
          [msg.slice(0, 250), m.id]
        );
        const body = err?.response?.body;
        if (body) {
          console.error("Email send failed:", err.message, JSON.stringify(body, null, 2));
        } else {
          console.error("Email send failed:", err);
        }

      }
    }

    return rows.length;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error("Email worker error:", err?.message || err);
    return 0;
  } finally {
    conn.release();
  }
}

async function main() {
  console.log("Email worker started. Provider:", String(process.env.EMAIL_PROVIDER || "mailtrap"));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await processOnce();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
