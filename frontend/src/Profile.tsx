import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import MyCourses from "./MyCourses";
import CreatorDashboard from "./CreatorDashboard";
import CreatedCourses from "./CreatedCourses";
import logo from "./assets/elitearn-logo.png";

type ProfileProps = {
  onGoCatalog?: () => void;
  forcePanel?: "purchased" | "create" | "created";
  onPanelChange?: (p: "purchased" | "create" | "created") => void;
};

export default function Profile({ onGoCatalog, forcePanel, onPanelChange }: ProfileProps) {
  const { user, login, register, logout } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "creator">("buyer");
  const [msg, setMsg] = useState<string | null>(null);

  const [panel, setPanel] = useState<"purchased" | "create" | "created">("purchased");

  const panelFromUrl = useMemo(() => {
    const p = searchParams.get("panel");
    return p === "purchased" || p === "create" || p === "created" ? p : null;
  }, [searchParams]);

  useEffect(() => {
    if (!panelFromUrl) return;
    setPanel(panelFromUrl);
  }, [panelFromUrl]);

  useEffect(() => {
    if (!forcePanel) return;
    setPanel(forcePanel);
  }, [forcePanel]);

  useEffect(() => {
    const current = searchParams.get("panel");
    if (current === panel) return;
    const next = new URLSearchParams(searchParams);
    next.set("panel", panel);
    setSearchParams(next, { replace: true });
  }, [panel, searchParams, setSearchParams]);

  useEffect(() => {
    onPanelChange?.(panel);
  }, [panel, onPanelChange]);

  const setPanelSafe = (p: "purchased" | "create" | "created") => {
    setPanel(p);
  };

  const submit = async () => {
    setMsg(null);

    try {
      if (!email.trim() || !password.trim()) {
        setMsg("Моля, попълни email и парола.");
        return;
      }

      if (mode === "login") {
        await login(email.trim(), password);
        setMsg(null);
      } else {
        await register(email.trim(), password, role);
        setMsg(null);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Грешка при автентикация");
    }
  };

  const roleLabel = (r: string) => {
    if (r === "buyer") return "Купувач";
    if (r === "creator") return "Създател";
    return r;
  };

  const onEnterSubmit = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  if (!user) {
    return (
      <div className="elite-layout-2">
        <div className="elite-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button
              className="elite-logo-btn"
              onClick={onGoCatalog}
              aria-label="Към Каталог"
              title="Към Каталог"
              disabled={!onGoCatalog}
            >
              <img className="elite-logo" src={logo} alt="Elitearn logo" />
            </button>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Профил</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ opacity: 0.8, fontSize: 13 }}>За да поръчаш, трябва да влезеш или да се регистрираш.</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className={`elite-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
                Вход
              </button>
              <button className={`elite-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
                Регистрация
              </button>
            </div>
          </div>

          {msg && (
            <div className="elite-note" style={{ marginTop: 12 }}>
              {msg}
            </div>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Email</span>
              <input
                className="elite-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onEnterSubmit}
                placeholder="email@domain.com"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Парола</span>
              <input
                className="elite-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onEnterSubmit}
                placeholder="••••••••"
              />
            </label>

            {mode === "register" && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Роля</span>
                <select
                  className="elite-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  onKeyDown={onEnterSubmit}
                >
                  <option value="buyer">Купувач</option>
                  <option value="creator">Създател (Creator)</option>
                </select>
              </label>
            )}

            <button className="elite-btn primary" onClick={submit}>
              {mode === "login" ? "Влез" : "Регистрирай"}
            </button>

            </div>
        </div>

      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="elite-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="elite-logo-btn"
              onClick={onGoCatalog}
              aria-label="Към Каталог"
              title="Към Каталог"
              disabled={!onGoCatalog}
            >
              <img className="elite-logo" src={logo} alt="Elitearn logo" />
            </button>

            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Влязъл потребител</div>
              <div style={{ opacity: 0.85 }}>
                {user.email} • Роля: {roleLabel(user.role)}
              </div>
            </div>
          </div>

          <button className="elite-btn" onClick={logout}>
            Изход
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className={`elite-tab ${panel === "purchased" ? "active" : ""}`}
            onClick={() => setPanelSafe("purchased")}
          >
            Моите курсове
          </button>

          {user.role !== "buyer" && (
            <>
              <button className={`elite-tab ${panel === "create" ? "active" : ""}`} onClick={() => setPanelSafe("create")}>
                Създай курс
              </button>
              <button className={`elite-tab ${panel === "created" ? "active" : ""}`} onClick={() => setPanelSafe("created")}>
                Създадени курсове
              </button>
            </>
          )}
        </div>
      </div>

      {panel === "purchased" && <MyCourses />}
      {panel === "create" && user.role !== "buyer" && <CreatorDashboard />}
      {panel === "created" && user.role !== "buyer" && <CreatedCourses />}
    </div>
  );
}
