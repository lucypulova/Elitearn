// Бизнес логика за регистрация и вход на потребител

const bcrypt = require("bcryptjs");
const { pool } = require("../db");

// Регистрация на нов потребител
async function registerUser({ email, password, role, profile }) {
  // Нормализиране на входа
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  // Разрешени роли (по подразбиране: buyer)
  const desiredRole = String(role || "buyer");
  const allowedRoles = ["buyer", "creator"];
  const finalRole = allowedRoles.includes(desiredRole) ? desiredRole : "buyer";

  // Проверка дали имейлът вече съществува
  const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [e]);
  if (exists.length > 0) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  // Хеширане на паролата
  const password_hash = await bcrypt.hash(p, 10);

  // Създаване на запис в users
  const [ins] = await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
    [e, password_hash, finalRole]
  );

  const userId = ins.insertId;

  // Данни за профил (ако са подадени)
  const full_name = profile?.full_name ?? null;
  const phone = profile?.phone ?? null;
  const billing_address = profile?.billing_address ?? null;
  const city = profile?.city ?? null;
  const country = profile?.country ?? null;

  // Създаване/обновяване на user_profiles (idempotent)
  await pool.query(
    `INSERT INTO user_profiles (user_id, full_name, phone, billing_address, city, country)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       full_name=VALUES(full_name),
       phone=VALUES(phone),
       billing_address=VALUES(billing_address),
       city=VALUES(city),
       country=VALUES(country)`,
    [userId, full_name, phone, billing_address, city, country]
  );

  return { id: userId, email: e, role: finalRole };
}

// Вход (login) на потребител
async function loginUser({ email, password }) {
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  // Търсим потребителя по имейл
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, role FROM users WHERE email = ?",
    [e]
  );

  if (rows.length === 0) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const userRow = rows[0];

  // Проверка на паролата чрез bcrypt
  const ok = await bcrypt.compare(p, userRow.password_hash);
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  return { id: userRow.id, email: userRow.email, role: userRow.role };
}

module.exports = { registerUser, loginUser };