import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { api } from "./api";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type CartItem = {
  course_id: number;
  title: string;
  price: number;
  qty?: number;
  line_total?: number;
};

type Cart = {
  cart_id: number;
  items: CartItem[];
  total: number;
};

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

function CheckoutInner({
  cart,
  reloadCart,
  onRequireAuth,
}: {
  cart: Cart;
  reloadCart: () => Promise<void>;
  onRequireAuth?: () => void;
}) {
  const { user } = useAuth();
  const { setServerCount } = useCart();
  const stripe = useStripe();
  const elements = useElements();

  const [loadingPay, setLoadingPay] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const translateStripeMessage = (message?: string | null) => {
    const m = (message || "").trim();
    if (!m) return "Плащането беше отказано. Провери данните и опитай отново.";

    const map: Record<string, string> = {
      "Your card number is incomplete.": "Номерът на картата е непълен.",
      "Your card number is invalid.": "Номерът на картата е невалиден.",
      "Your card's expiration date is incomplete.": "Датата на валидност е непълна.",
      "Your card's expiration date is invalid.": "Датата на валидност е невалидна.",
      "Your card's security code is incomplete.": "CVC кодът е непълен.",
      "Your card's security code is invalid.": "CVC кодът е невалиден.",
      "Your postal code is incomplete.": "Пощенският код е непълен.",
      "Your postal code is invalid.": "Пощенският код е невалиден.",
      "Your card was declined.": "Картата беше отказана.",
      "Your card has expired.": "Картата е с изтекла валидност.",
      "Your card's security code is incorrect.": "CVC кодът е грешен.",
      "Your card does not support this type of purchase.": "Картата не поддържа този тип плащане.",
      "Processing error.": "Възникна техническа грешка при обработването на плащането.",
    };

    return map[m] || "Плащането не може да бъде завършено. Провери данните и опитай отново.";
  };

  const checkout = async () => {
    setMsg(null);

    if (!user) {
      setMsg("За да завършиш поръчка, трябва първо да влезеш или да се регистрираш.");
      onRequireAuth?.();
      return;
    }

    if (!stripe || !elements) {
      setMsg("Stripe не е готов. Презареди страницата и опитай пак.");
      return;
    }

    if (!cart.items.length) return;

    setLoadingPay(true);
    try {
      const created = await api.post("/orders", { customer: {} });
      const orderId = created.data.order_id as number;
      const orderNo = created.data.order_number as string;

      const processed = await api.post(`/orders/${orderId}/process`, {});
      const clientSecret = processed.data?.client_secret as string | undefined;

      if (!clientSecret) {
        setMsg(`Поръчката е обработена: ${processed.data?.order_number || orderNo}.`);
        await reloadCart();
        return;
      }

      setMsg(`Поръчка ${orderNo}: потвърди плащането…`);

      const card = elements.getElement(CardElement);
      if (!card) {
        setMsg("Липсва поле за карта.");
        return;
      }

      const confirmRes = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });

      if (confirmRes.error) {
        setMsg(translateStripeMessage(confirmRes.error.message));
        return;
      }

      const intent = confirmRes.paymentIntent;
      if (!intent) {
        setMsg("Няма payment intent от Stripe.");
        return;
      }

      if (intent.status !== "succeeded") {
        setMsg(`Плащането не е завършено: ${intent.status}`);
        return;
      }

      const confirmed = await api.post(`/orders/${orderId}/confirm`, {
        payment_intent_id: intent.id,
      });

      setMsg(
        `Поръчката е завършена: ${confirmed.data?.order_number || orderNo}. Достъпът е активиран в „Моите курсове“.`
      );

      await reloadCart();
      try {
        const res = await api.get("/cart");
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        setServerCount(items.length);
      } catch {
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e?.message || "Грешка при поръчката");
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <>
      {msg && (
        <div className="elite-note" style={{ marginTop: 12 }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Плащане</div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
          <CardElement
  options={{
    hidePostalCode: true,
    style: {
      base: {
        color: "#ffffff",
        fontSize: "16px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        "::placeholder": {
          color: "rgba(255,255,255,0.5)",
        },
      },
      invalid: {
        color: "#ff6b6b",
      },
    },
  }}
/>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Тест карта: 4242 4242 4242 4242, дата: 12/34, CVC: 123
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Общо: {Number(cart.total).toFixed(2)} €</div>
        <button className="elite-btn primary" onClick={checkout} disabled={!cart.items.length || loadingPay}>
          {loadingPay ? "Обработване…" : "Поръчай"}
        </button>
      </div>
    </>
  );
}

export default function CartView({ onRequireAuth }: { onRequireAuth?: () => void }) {
  const { user } = useAuth();
  const { guestItems, guestTotal, removeGuest, setServerCount } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const emptyCart: Cart = { cart_id: 0, items: [], total: 0 };

  const load = async () => {
    if (!user) {
      setCart(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await api.get("/cart");
      const data = res.data as Cart;

      const items = Array.isArray(data?.items) ? data.items : [];
      const needsNormalize = items.some((it) => Number((it as any).qty || 1) !== 1);

      if (needsNormalize) {
        try {
          await Promise.all(items.map((it) => api.put(`/cart/items/${it.course_id}`, { qty: 1 }).catch(() => null)));
          const res2 = await api.get("/cart");
          setCart(res2.data);
          setServerCount(Array.isArray(res2?.data?.items) ? res2.data.items.length : 0);
        } catch {
          setCart(data);
          setServerCount(items.length);
        }
      } else {
        setCart(data);
        setServerCount(items.length);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Грешка при зареждане на кошницата");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const guestCart = useMemo(() => {
    const items = guestItems.map((it) => ({
      course_id: it.course_id,
      title: it.title,
      price: it.price,
      line_total: Number(it.price),
    }));

    return { cart_id: 0, items, total: guestTotal };
  }, [guestItems, guestTotal]);

  const effectiveCart = user ? cart ?? emptyCart : guestCart;

  const removeServerItem = async (courseId: number) => {
    if (!user) return;
    setMsg(null);
    try {
      const res = await api.delete(`/cart/items/${courseId}`);
      setCart(res.data);
      setServerCount(Array.isArray(res?.data?.items) ? res.data.items.length : 0);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Грешка при премахване от кошницата");
    }
  };

  return (
    <div className="elite-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Кошница</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            {user ? "Кошницата е свързана с профила ти." : "Гост кошница (без вход). За поръчка е нужен вход/регистрация."}
          </div>
        </div>

        {!user && (
          <button className="elite-btn sm" onClick={() => onRequireAuth?.()}>
            Вход / Регистрация
          </button>
        )}
      </div>

      {msg && (
        <div className="elite-note" style={{ marginTop: 12 }}>
          {msg}
        </div>
      )}

      {loading && <div style={{ marginTop: 14, opacity: 0.85 }}>Зареждане…</div>}

      {!loading && (
        <>
          {effectiveCart.items.length === 0 ? (
            <div style={{ marginTop: 14, opacity: 0.85 }}>Няма добавени курсове.</div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {effectiveCart.items.map((it) => (
                <div
                  key={it.course_id}
                  className="elite-row"
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>{it.title}</div>

                    <button
                      className="elite-btn sm"
                      onClick={() => (user ? void removeServerItem(it.course_id) : removeGuest(it.course_id))}
                    >
                      Премахни
                    </button>
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 13 }}>{Number(it.price).toFixed(2)} €</div>
                </div>
              ))}
            </div>
          )}

          {!user ? (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Общо: {Number(effectiveCart.total).toFixed(2)} €</div>
              <button
                className="elite-btn primary"
                onClick={() => {
                  setMsg("За да завършиш поръчка, трябва първо да влезеш или да се регистрираш.");
                  onRequireAuth?.();
                }}
                disabled={effectiveCart.items.length === 0}
              >
                Поръчай
              </button>
            </div>
          ) : (
            <Elements stripe={stripePromise}>
              <CheckoutInner cart={effectiveCart} reloadCart={load} onRequireAuth={onRequireAuth} />
            </Elements>
          )}
        </>
      )}
    </div>
  );
}
