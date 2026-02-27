const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { JWT_SECRET, readTokenFromRequest } = require("../config/security");

// Middleware за задължителна автентикация
async function requireAuth(req, res, next) {
  try {
    // Извличаме токена от заявката (header/cookie)
    const token = readTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    // Валидираме JWT и извличаме payload
    const payload = jwt.verify(token, JWT_SECRET);

    // sub съдържа userId
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId))
      return res.status(401).json({ error: "Invalid token" });

    // Проверяваме дали потребителят съществува в БД
    const [rows] = await pool.query(
      "SELECT id, email, role, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "User not found" });

    // Записваме потребителя в req за следващите middleware-и
    req.user = rows[0];

    next(); // продължаваме към защитения route
  } catch (_) {
    // Невалиден / изтекъл токен
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Middleware за проверка на роля (RBAC)
function requireRole(...roles) {
  return (req, res, next) => {
    // Трябва първо да има автентикиран потребител
    if (!req.user)
      return res.status(401).json({ error: "Unauthorized" });

    // Проверка дали ролята е позволена
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Forbidden" });

    next();
  };
}

module.exports = { requireAuth, requireRole };