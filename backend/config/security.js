const jwt = require("jsonwebtoken");

// Секретен ключ за подписване на JWT.
// В продукция задължително идва от ENV променлива.
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// Генерира JWT за даден потребител
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,       // subject = userId
      email: user.email,  // допълнителни claims
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d", // валидност 7 дни
    }
  );
}

// Извлича JWT от заявката
function readTokenFromRequest(req) {
  const auth = String(req.headers.authorization || "");

  // Стандартен формат: Authorization: Bearer <token>
  if (auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }

  // Алтернативно: ?token=... (напр. за download линкове)
  if (req.query && req.query.token) {
    return String(req.query.token);
  }

  return null;
}

module.exports = { JWT_SECRET, signToken, readTokenFromRequest };