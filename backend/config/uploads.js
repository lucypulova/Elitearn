const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

// Абсолютен път до папката за качени файлове
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Уверяваме се, че папката uploads съществува
function ensureUploadsReady() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Middleware за достъп до качените файлове
// Позволява достъп през URL: /uploads/<filename>
function uploadsStaticMiddleware() {
  return require("express").static(UPLOADS_DIR);
}

// Създава конфигурация за multer (качване на файлове)
function createUpload() {
  ensureUploadsReady(); // гарантираме, че директорията е налична

  return multer({
    storage: multer.diskStorage({
      // Къде да се записва файлът
      destination: (req, file, cb) => cb(null, UPLOADS_DIR),

      // Генериране на уникално име на файла
      filename: (req, file, cb) => {
        // Премахваме опасни символи от оригиналното име
        const safeName = String(file.originalname || "file")
          .replace(/[^\w.\-()+ ]/g, "_");

        // Добавяме timestamp + UUID за уникалност
        cb(null, `${Date.now()}_${uuidv4()}_${safeName}`);
      },
    }),

    // Ограничение на размера: 25 MB
    limits: { fileSize: 25 * 1024 * 1024 },
  });
}

module.exports = {
  UPLOADS_DIR,
  ensureUploadsReady,
  uploadsStaticMiddleware,
  createUpload,
};