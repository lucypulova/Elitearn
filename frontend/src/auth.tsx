import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export type User = { id: number; email: string; role: "buyer" | "creator" | "admin" };

type AuthState = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: "buyer" | "creator") => Promise<void>;
  logout: () => void;
};

const TOKEN_KEY = "elitearn_token";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      delete api.defaults.headers.common["Authorization"];
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const res = await api.get("/private/me");
        setUser(res.data.user);
      } catch {
        setToken(null);
        setUser(null);
      }
    })();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const register = async (email: string, password: string, role: "buyer" | "creator") => {
    const res = await api.post("/auth/register", { email, password, role });
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, login, register, logout }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getTokenForLinks() {
  return localStorage.getItem(TOKEN_KEY);
}
