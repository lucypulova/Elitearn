import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../../shared/api/http";
import { useAuth } from "../auth/authContext";

export type GuestCartItem = {
  course_id: number;
  title: string;
  price: number;
};

type CartState = {
  guestItems: GuestCartItem[];
  guestCount: number;
  guestTotal: number;
  addGuest: (item: GuestCartItem) => void;
  removeGuest: (courseId: number) => void;
  clearGuest: () => void;

  serverCount: number;
  refreshServerCount: () => Promise<void>;
  setServerCount: (n: number) => void;

  cartCount: number;
};

const GUEST_CART_KEY = "elitearn_guest_cart";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>(() =>
    safeParse<GuestCartItem[]>(localStorage.getItem(GUEST_CART_KEY), [])
  );

  const [serverCount, setServerCount] = useState(0);

  // persist guest cart
  useEffect(() => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestItems));
  }, [guestItems]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      if (guestItems.length === 0) return;

      try {
        for (const it of guestItems) {
          await api.post("/cart/items", { course_id: it.course_id, qty: 1 });
        }
        setGuestItems([]);
        await refreshServerCount();
      } catch {
        // best-effort sync; if it fails, keep guest cart so user can retry later
      }
    })();
    // Intentionally depends on guestItems so the sync runs after login and after changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, guestItems]);

  const refreshServerCount = async () => {
    if (!user) {
      setServerCount(0);
      return;
    }
    try {
      const res = await api.get("/cart");
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setServerCount(items.length);
    } catch {
    }
  };

  useEffect(() => {
    void refreshServerCount();
  }, [user?.id]);

  const addGuest = (item: GuestCartItem) => {
    setGuestItems((prev) => {
      const exists = prev.some((x) => x.course_id === item.course_id);
      if (exists) return prev;
      return [item, ...prev];
    });
  };

  const removeGuest = (courseId: number) => {
    setGuestItems((prev) => prev.filter((x) => x.course_id !== courseId));
  };

  const clearGuest = () => setGuestItems([]);

  const guestCount = useMemo(() => guestItems.length, [guestItems]);
  const guestTotal = useMemo(() => guestItems.reduce((s, x) => s + Number(x.price), 0), [guestItems]);

  const cartCount = user ? serverCount : guestCount;

  const value = useMemo(
    () => ({
      guestItems,
      guestCount,
      guestTotal,
      addGuest,
      removeGuest,
      clearGuest,
      serverCount,
      refreshServerCount,
      setServerCount,
      cartCount,
    }),
    [guestItems, guestCount, guestTotal, serverCount, cartCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
