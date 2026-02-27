// Бизнес логика за кошницата (carts + cart_items)

const { pool } = require("../db"); // (ако не се ползва директно тук, може да се махне)

// Намира активна кошница за user или създава нова
async function getOrCreateActiveCartId(executor, userId) {
  const [existing] = await executor.query(
    "SELECT id FROM carts WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [userId]
  );
  if (existing.length > 0) return existing[0].id;

  const [ins] = await executor.query(
    "INSERT INTO carts (user_id, status) VALUES (?, 'active')",
    [userId]
  );
  return ins.insertId;
}

// Чете кошницата + изчислява subtotal/total
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

// Добавя артикул (ако вече съществува → увеличава qty)
async function addCartItem(executor, userId, courseId, qty) {
  const cartId = await getOrCreateActiveCartId(executor, userId);

  await executor.query(
    `INSERT INTO cart_items (cart_id, course_id, qty)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
    [cartId, courseId, qty]
  );

  return readCart(executor, userId);
}

// Променя количество (qty<=0 → премахва артикула)
async function updateCartItemQty(executor, userId, courseId, qty) {
  const cartId = await getOrCreateActiveCartId(executor, userId);

  if (qty <= 0) {
    await executor.query(
      "DELETE FROM cart_items WHERE cart_id = ? AND course_id = ?",
      [cartId, courseId]
    );
    return readCart(executor, userId);
  }

  await executor.query(
    "UPDATE cart_items SET qty = ? WHERE cart_id = ? AND course_id = ?",
    [qty, cartId, courseId]
  );

  return readCart(executor, userId);
}

// Премахва артикул от кошницата
async function removeCartItem(executor, userId, courseId) {
  const cartId = await getOrCreateActiveCartId(executor, userId);

  await executor.query(
    "DELETE FROM cart_items WHERE cart_id = ? AND course_id = ?",
    [cartId, courseId]
  );

  return readCart(executor, userId);
}

module.exports = {
  getOrCreateActiveCartId,
  readCart,
  addCartItem,
  updateCartItemQty,
  removeCartItem,
};