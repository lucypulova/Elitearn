const express = require("express");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendBadRequest, makeOrderNumber, toCents } = require("../utils/http");
const { PAYMENT_PROVIDER, STRIPE_CURRENCY, STRIPE_SECRET_KEY, stripe, authorizePaymentTest } = require("../config/payments");
const { getOrCreateActiveCartId } = require("../services/cartService");
const { logOrderEvent, fulfillOrder } = require("../services/orderService");

const router = express.Router();

router.post("/orders", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const full_name = (req.body?.customer?.full_name || "").trim() || null;
    const phone = (req.body?.customer?.phone || "").trim() || null;

    await conn.beginTransaction();

    const cartId = await getOrCreateActiveCartId(conn, userId);

    const [cartItems] = await conn.query(
      `SELECT ci.course_id, ci.qty, cr.price
       FROM cart_items ci
       JOIN courses cr ON cr.id = ci.course_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (cartItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Cart is empty" });
    }

    const courseIds = cartItems.map((x) => Number(x.course_id)).filter((n) => Number.isFinite(n));
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => "?").join(",");
      const [owned] = await conn.query(
        `SELECT course_id FROM enrollments WHERE user_id = ? AND status = 'active' AND course_id IN (${placeholders})`,
        [userId, ...courseIds]
      );
      if (owned.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "В кошницата има курс, който вече е закупен." });
      }
    }

    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => "?").join(",");
      const [own] = await conn.query(
        `SELECT id FROM courses WHERE creator_user_id = ? AND id IN (${placeholders}) LIMIT 1`,
        [userId, ...courseIds]
      );
      if (own.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: "В кошницата има курс, който е създаден от теб. Не можеш да го закупиш.",
        });
      }
    }

    const orderNumber = makeOrderNumber();
    const subtotal = cartItems.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);
    const total = subtotal;

    const [orderIns] = await conn.query(
      `INSERT INTO orders (order_number, user_id, status, full_name, phone, subtotal, total)
       VALUES (?, ?, 'created', ?, ?, ?, ?)`,
      [orderNumber, userId, full_name, phone, subtotal, total]
    );
    const orderId = orderIns.insertId;

    for (const it of cartItems) {
      const unit = Number(it.price);
      const qty = Number(it.qty);
      const line = unit * qty;

      await conn.query(
        `INSERT INTO order_items (order_id, course_id, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, it.course_id, unit, qty, line]
      );
    }

    await conn.query("UPDATE carts SET status = 'ordered' WHERE id = ?", [cartId]);
    await conn.query("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);

    await logOrderEvent(conn, orderId, "ORDER_CREATED", "Order created from cart", {
      cart_id: cartId,
      items: cartItems.map((x) => ({ course_id: x.course_id, qty: x.qty, price: x.price })),
    });

    await conn.commit();

    res
      .status(201)
      .json({ ok: true, order_id: orderId, order_number: orderNumber, status: "created", subtotal, total });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

router.post("/orders/:orderId/process", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return sendBadRequest(res, "Invalid orderId");

    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `SELECT id, order_number, user_id, status, total
       FROM orders
       WHERE id = ? FOR UPDATE`,
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

    if (order.user_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: "No access to this order" });
    }

    if (order.status === "completed") {
      await conn.rollback();
      return res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed" });
    }

    if (!["created", "payment_failed"].includes(order.status)) {
      await conn.rollback();
      return res.status(409).json({ error: `Order cannot be processed from status: ${order.status}` });
    }

    await conn.query("UPDATE orders SET status='payment_authorizing' WHERE id=?", [orderId]);
    await logOrderEvent(conn, orderId, "PAYMENT_AUTH_START", "Starting payment authorization", {
      provider: PAYMENT_PROVIDER,
    });

    if (PAYMENT_PROVIDER === "stripe") {
      if (!stripe || !STRIPE_SECRET_KEY) {
        await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Stripe not configured", null);
        await conn.commit();
        return res.status(500).json({ error: "Stripe not configured. Missing STRIPE_SECRET_KEY." });
      }

      const cents = toCents(order.total);

      if (cents < 0) {
        await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Total must be >= 0", { total: order.total });
        await conn.commit();
        return res.status(400).json({ error: "Invalid order total" });
      }

      if (cents === 0) {
        await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
        await conn.query(
          `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
           VALUES (?, ?, NULL, 'captured', ?, ?, JSON_OBJECT('free', true))`,
          [orderId, "stripe", 0, STRIPE_CURRENCY]
        );
        await logOrderEvent(conn, orderId, "PAYMENT_AUTH_OK", "Free order (no payment required)", {
          total: order.total,
        });

        const result = await fulfillOrder(conn, {
          orderId,
          userId,
          userEmail: req.user.email,
          orderNumber: order.order_number,
        });
        if (!result.ok) {
          await conn.commit();
          return res.status(result.code).json({ ok: false, error: result.error });
        }

        await conn.commit();
        return res.json({
          ok: true,
          provider: "stripe",
          free: true,
          order_id: orderId,
          order_number: order.order_number,
          status: "completed",
          granted_courses: result.granted_courses,
        });
      }

      const intent = await stripe.paymentIntents.create({
        amount: cents,
        currency: STRIPE_CURRENCY.toLowerCase(),
        payment_method_types: ["card"],
        description: `Order ${order.order_number}`,
        receipt_email: req.user.email || undefined,
        metadata: { order_id: String(orderId), order_number: order.order_number, user_id: String(userId) },
      });

      await conn.query(
        `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
         VALUES (?, 'stripe', ?, 'initiated', ?, ?, ?)`,
        [orderId, intent.id, Number(order.total || 0), STRIPE_CURRENCY, JSON.stringify(intent)]
      );
      await logOrderEvent(conn, orderId, "PAYMENT_INTENT_CREATED", "Stripe PaymentIntent created", {
        intent_id: intent.id,
      });

      await conn.commit();
      return res.json({
        ok: true,
        provider: "stripe",
        order_id: orderId,
        order_number: order.order_number,
        status: "payment_authorizing",
        client_secret: intent.client_secret,
      });
    }

    const pay = await authorizePaymentTest({
      amount: order.total,
      currency: STRIPE_CURRENCY,
      orderNumber: order.order_number,
    });

    await conn.query(
      `INSERT INTO payments (order_id, provider, intent_id, status, amount, currency, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        pay.provider,
        pay.intent_id,
        pay.ok ? "authorized" : "failed",
        Number(order.total || 0),
        STRIPE_CURRENCY,
        JSON.stringify(pay.raw || {}),
      ]
    );

    if (!pay.ok) {
      await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
      await logOrderEvent(conn, orderId, "PAYMENT_AUTH_FAIL", "Payment declined (test)", pay.raw || null);
      await conn.commit();
      return res.status(402).json({ ok: false, status: "payment_failed", error: "Payment declined (simulated)" });
    }

    await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
    await logOrderEvent(conn, orderId, "PAYMENT_AUTH_OK", "Payment authorized (test)", {
      intent_id: pay.intent_id,
    });

    const result = await fulfillOrder(conn, {
      orderId,
      userId,
      userEmail: req.user.email,
      orderNumber: order.order_number,
    });
    if (!result.ok) {
      await conn.commit();
      return res.status(result.code).json({ ok: false, error: result.error });
    }

    await conn.commit();
    return res.json({
      ok: true,
      order_id: orderId,
      order_number: order.order_number,
      status: "completed",
      granted_courses: result.granted_courses,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

router.post("/orders/:orderId/confirm", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    if (PAYMENT_PROVIDER !== "stripe") return res.status(400).json({ error: "Stripe is not enabled" });
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const userId = req.user.id;
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return sendBadRequest(res, "Invalid orderId");

    const payment_intent_id = String(req.body?.payment_intent_id || "").trim();
    if (!payment_intent_id) return sendBadRequest(res, "payment_intent_id is required");

    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `SELECT id, order_number, user_id, status, total
       FROM orders
       WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];
    if (order.user_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: "No access to this order" });
    }

    if (order.status === "completed") {
      await conn.rollback();
      return res.json({ ok: true, order_id: orderId, order_number: order.order_number, status: "completed" });
    }

    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (!intent) {
      await conn.rollback();
      return res.status(400).json({ error: "Invalid payment_intent_id" });
    }

    try {
      await conn.query(
        "UPDATE payments SET status = ?, raw_response = ? WHERE order_id = ? AND intent_id = ?",
        [intent.status, JSON.stringify(intent), orderId, payment_intent_id]
      );
    } catch (_) {}

    if (intent.status !== "succeeded") {
      await conn.query("UPDATE orders SET status='payment_failed' WHERE id=?", [orderId]);
      await logOrderEvent(conn, orderId, "PAYMENT_CAPTURE_FAIL", "Stripe intent not succeeded", {
        status: intent.status,
      });
      await conn.commit();
      return res.status(402).json({ ok: false, status: "payment_failed", error: "Payment not succeeded" });
    }

    await conn.query("UPDATE orders SET status='payment_authorized' WHERE id=?", [orderId]);
    await logOrderEvent(conn, orderId, "PAYMENT_CAPTURED", "Stripe payment captured", {
      intent_id: intent.id,
    });

    const result = await fulfillOrder(conn, {
      orderId,
      userId,
      userEmail: req.user.email,
      orderNumber: order.order_number,
    });
    if (!result.ok) {
      await conn.commit();
      return res.status(result.code).json({ ok: false, error: result.error });
    }

    await conn.commit();
    res.json({
      ok: true,
      provider: "stripe",
      order_id: orderId,
      order_number: order.order_number,
      status: "completed",
      granted_courses: result.granted_courses,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

// My orders
router.get("/me/orders", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, order_number, status, subtotal, total, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// My purchased courses
router.get("/me/courses", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         e.course_id,
         e.created_at AS enrolled_at,
         cr.title, cr.description, cr.price, cr.creator_user_id, cr.category_id,
         c.name AS category_name,
         d.id AS department_id,
         d.name AS department_name
       FROM enrollments e
       JOIN courses cr ON cr.id = e.course_id
       JOIN categories c ON c.id = cr.category_id
       JOIN departments d ON d.id = c.department_id
       WHERE e.user_id = ? AND e.status = 'active'
       ORDER BY e.id DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
