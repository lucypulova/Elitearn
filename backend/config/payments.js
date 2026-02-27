const Stripe = require("stripe");

// Кой payment provider да се използва: "stripe" или "test"
const PAYMENT_PROVIDER = String(
  process.env.PAYMENT_PROVIDER || "test"
).toLowerCase();

// Stripe конфигурация (използва се само ако provider = stripe)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_CURRENCY = String(
  process.env.STRIPE_CURRENCY || "EUR"
).toUpperCase();

// Инициализация на Stripe само ако е избран като provider
const stripe =
  PAYMENT_PROVIDER === "stripe"
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
    : null;

/**
 * Симулирана авторизация на плащане (test provider).
 * Използва се за development / demo без реален Stripe.
 */
async function authorizePaymentTest({ amount, currency, orderNumber }) {
  const amountNum = Number(amount || 0);

  // Сумата трябва да е положителна
  if (!(amountNum > 0)) {
    return {
      ok: false,
      provider: "test",
      intent_id: null,
      raw: { reason: "amount_must_be_positive" },
    };
  }

  // Симулираме отказ:
  // ако последната цифра на orderNumber е нечетна
  // и сумата е над 100 → отказ
  const last = Number(String(orderNumber || "").slice(-1));
  const shouldFail =
    Number.isFinite(last) && last % 2 === 1 && amountNum > 100;

  if (shouldFail) {
    return {
      ok: false,
      provider: "test",
      intent_id: `test_fail_${Date.now()}`,
      raw: { reason: "simulated_decline" },
    };
  }

  // Успешна "авторизация"
  return {
    ok: true,
    provider: "test",
    intent_id: `test_auth_${Date.now()}`,
    raw: { authorized: true, amount: amountNum, currency },
  };
}

module.exports = {
  PAYMENT_PROVIDER,
  STRIPE_SECRET_KEY,
  STRIPE_CURRENCY,
  stripe,
  authorizePaymentTest,
};