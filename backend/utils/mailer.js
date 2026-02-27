// Унифициран модул за изпращане на имейли.
// Поддържа два доставчика:
//  - Mailtrap (SMTP)
//  - SendGrid (HTTP API)
// Използва се от worker_email.js за изпращане на съобщения
// от таблицата notification_outbox.

const provider = String(process.env.EMAIL_PROVIDER || 'mailtrap').toLowerCase();
// Определяме кой доставчик да се използва.
// По подразбиране: mailtrap.

function requireEnv(name) {
  // Помощна функция – гарантира, че дадена env променлива съществува.
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function getFrom() {
  // Определя подателя на имейла.
  // Приоритет:
  // 1. EMAIL_FROM
  // 2. SENDGRID_FROM
  // 3. fallback стойност
  return process.env.EMAIL_FROM || process.env.SENDGRID_FROM || 'Elitearn <no-reply@elitearn.dev>';
}

/**
 * Изпращане чрез Mailtrap (SMTP).
 * Използва nodemailer.
 */
async function sendViaMailtrap({ to, subject, text, html, attachments }) {
  const nodemailer = require('nodemailer');

  // Четем задължителните SMTP настройки
  const host = requireEnv('MAILTRAP_HOST');
  const port = Number(requireEnv('MAILTRAP_PORT'));
  const user = requireEnv('MAILTRAP_USER');
  const pass = requireEnv('MAILTRAP_PASS');

  // Определяме дали да използваме secure (TLS).
  // Ако MAILTRAP_SECURE е зададено – използваме него.
  // Иначе: порт 465 означава implicit TLS.
  const secureEnv = process.env.MAILTRAP_SECURE;
  const secure = secureEnv != null
    ? String(secureEnv).toLowerCase() === 'true'
    : port === 465;

  // Дали да се валидира TLS сертификата.
  const rejectUnauthorizedEnv = process.env.MAILTRAP_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = rejectUnauthorizedEnv != null
    ? String(rejectUnauthorizedEnv).toLowerCase() === 'true'
    : true;

  // Създаваме SMTP transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });

  // Изпращаме имейла
  return transporter.sendMail({
    from: getFrom(),
    to,
    subject,
    text: text || undefined,   // plain text версия
    html: html || undefined,   // HTML версия
    attachments: Array.isArray(attachments) && attachments.length
      ? attachments
      : undefined,
  });
}

/**
 * Изпращане чрез SendGrid (HTTP API).
 */
async function sendViaSendGrid({ to, subject, text, html, attachments }) {
  const sgMail = require('@sendgrid/mail');

  // API ключ (задължителен)
  const key = requireEnv('SENDGRID_API_KEY');
  sgMail.setApiKey(key);

  // SendGrid изисква attachments в base64 формат.
  // Поддържаме два варианта:
  // 1. { content, filename, type }
  // 2. { path, filename, contentType } → четем файла от диск
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

        // Ако няма content, но има path → четем файла
        if (!content && a.path) {
          content = fs.readFileSync(a.path).toString('base64');
        }
        // Ако content е Buffer → конвертираме в base64
        else if (Buffer.isBuffer(content)) {
          content = content.toString('base64');
        }

        if (!content) continue;

        sgAttachments.push({
          content,
          filename,
          type,
          disposition: 'attachment',
        });
      } catch (_) {
        // Игнорираме грешка за конкретен attachment,
        // без да прекъсваме изпращането.
      }
    }

    if (!sgAttachments.length) sgAttachments = undefined;
  }

  // Изпращаме чрез SendGrid API
  return sgMail.send({
    to,
    from: getFrom(),
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments: sgAttachments,
  });
}

/**
 * Главна функция – унифициран вход.
 * Избира доставчик според EMAIL_PROVIDER.
 */
async function sendMail({ to, subject, text, html, attachments }) {
  if (!to) throw new Error('Missing to');
  if (!subject) throw new Error('Missing subject');

  if (provider === 'sendgrid') {
    return sendViaSendGrid({ to, subject, text, html, attachments });
  }

  // По подразбиране използваме Mailtrap
  return sendViaMailtrap({ to, subject, text, html, attachments });
}

module.exports = { sendMail };