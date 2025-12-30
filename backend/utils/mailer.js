// utils/mailer.js
// Unified email sender supporting Mailtrap (SMTP) and SendGrid (API).
// Used by worker_email.js to deliver messages from notification_outbox.

const provider = String(process.env.EMAIL_PROVIDER || 'mailtrap').toLowerCase();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function getFrom() {
  return process.env.EMAIL_FROM || process.env.SENDGRID_FROM || 'Elitearn <no-reply@elitearn.dev>';
}

async function sendViaMailtrap({ to, subject, text, html, attachments }) {
  const nodemailer = require('nodemailer');
  const host = requireEnv('MAILTRAP_HOST');
  const port = Number(requireEnv('MAILTRAP_PORT'));
  const user = requireEnv('MAILTRAP_USER');
  const pass = requireEnv('MAILTRAP_PASS');

  // Mailtrap can be used via SMTP with either STARTTLS (typically 2525/587)
  // or implicit TLS (typically 465). We infer secure from port, but allow override.
  const secureEnv = process.env.MAILTRAP_SECURE;
  const secure = secureEnv != null ? String(secureEnv).toLowerCase() === 'true' : port === 465;
  const rejectUnauthorizedEnv = process.env.MAILTRAP_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = rejectUnauthorizedEnv != null ? String(rejectUnauthorizedEnv).toLowerCase() === 'true' : true;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });

  return transporter.sendMail({
    from: getFrom(),
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
  });
}

async function sendViaSendGrid({ to, subject, text, html, attachments }) {
  const sgMail = require('@sendgrid/mail');
  const key = requireEnv('SENDGRID_API_KEY');
  sgMail.setApiKey(key);

  // SendGrid expects base64 attachments.
  // We support attachments that are provided either as {content, filename, type}
  // or as {path, filename, contentType}. In the latter case we read the file.
  let sgAttachments;
  if (Array.isArray(attachments) && attachments.length) {
    const fs = require('fs');
    sgAttachments = [];
    for (const a of attachments) {
      try {
        if (!a) continue;
        const filename = a.filename || a.name || 'file';
        const type = a.contentType || a.type || undefined;
        let content = a.content;
        if (!content && a.path) {
          content = fs.readFileSync(a.path).toString('base64');
        } else if (Buffer.isBuffer(content)) {
          content = content.toString('base64');
        }
        if (!content) continue;
        sgAttachments.push({ content, filename, type, disposition: 'attachment' });
      } catch (_) {
        // ignore per-attachment errors
      }
    }
    if (!sgAttachments.length) sgAttachments = undefined;
  }

  return sgMail.send({
    to,
    from: getFrom(),
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: sgAttachments,
  });
}

async function sendMail({ to, subject, text, html, attachments }) {
  if (!to) throw new Error('Missing to');
  if (!subject) throw new Error('Missing subject');

  if (provider === 'sendgrid') {
    return sendViaSendGrid({ to, subject, text, html, attachments });
  }

  // default
  return sendViaMailtrap({ to, subject, text, html, attachments });
}

module.exports = { sendMail };
