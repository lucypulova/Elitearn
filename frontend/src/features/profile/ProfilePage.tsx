import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api/http";
import { useAuth } from "../auth/authContext";
import MyCourses from "../courses/pages/MyCourses";
import CreatorDashboard from "../courses/pages/CreatorDashboard";
import CreatedCourses from "../courses/pages/CreatedCourses";
import logo from "../../assets/elitearn-logo.png";

type ProfileProps = {
  onGoCatalog?: () => void;
  forcePanel?: "purchased" | "create" | "created";
  onPanelChange?: (p: "purchased" | "create" | "created") => void;
};

type UserProfile = {
  user_id: number;
  full_name: string | null;
  phone: string | null;
  billing_address: string | null;
  city: string | null;
  country: string | null;
  avatar_url?: string | null;
  updated_at: string | null;
};

export default function Profile({ onGoCatalog, forcePanel, onPanelChange }: ProfileProps) {
  const { user, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "creator">("buyer");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [msg, setMsg] = useState<string | null>(null);

  const [panel, setPanel] = useState<"purchased" | "create" | "created">("purchased");
  const [settingsTab, setSettingsTab] = useState<"overview" | "profile" | "security">("overview");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdNew2, setPwdNew2] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const setPanelSafe = (p: "purchased" | "create" | "created") => setPanel(p);

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

  const submit = async () => {
    setMsg(null);

    try {
      const e = email.trim().toLowerCase();
      if (!e || !e.includes("@")) {
        setMsg("Моля, въведи валиден email адрес.");
        return;
      }
      if (password.trim().length < 6) {
        setMsg("Паролата трябва да е поне 6 символа.");
        return;
      }

      if (mode === "login") {
        await login(e, password);
        setMsg(null);
      } else {
        const full_name = `${firstName.trim()} ${lastName.trim()}`.trim() || undefined;
        await register({
          email: e,
          password,
          role,
          full_name,
          phone: phone.trim() || undefined,
          billing_address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        });
        setMsg(null);
      }
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Грешка при автентикация");
    }
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/me/profile");
        setProfile(res.data);
      } catch {
        setProfile(null);
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setMsg(null);
    setProfileSaving(true);
    try {
      const res = await api.put("/me/profile", {
        full_name: profile?.full_name ?? "",
        phone: profile?.phone ?? "",
        billing_address: profile?.billing_address ?? "",
        city: profile?.city ?? "",
        country: profile?.country ?? "",
      });
      setProfile(res.data);
      setMsg("Профилът е обновен.");
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Неуспешно обновяване на профила.");
    } finally {
      setProfileSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api.post("/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile(res.data);
      setMsg("Профилната снимка е обновена.");
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Неуспешно качване на снимка.");
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setMsg(null);
    try {
      const res = await api.delete("/me/avatar");
      setProfile(res.data);
      setMsg("Профилната снимка е премахната.");
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Неуспешно премахване на снимка.");
    }
  };

  const changePassword = async () => {
    setMsg(null);

    if (pwdNew.trim().length < 6) {
      setMsg("Новата парола трябва да е поне 6 символа.");
      return;
    }
    if (pwdNew !== pwdNew2) {
      setMsg("Новата парола и потвърждението не съвпадат.");
      return;
    }

    setPwdSaving(true);
    try {
      await api.post("/me/change-password", { current_password: pwdCurrent, new_password: pwdNew });
      setPwdCurrent("");
      setPwdNew("");
      setPwdNew2("");
      setMsg("Паролата е сменена успешно.");
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Неуспешна смяна на парола.");
    } finally {
      setPwdSaving(false);
    }
  };

  const deleteAccount = async () => {
    setMsg(null);
    if (deletePwd.trim().length < 1) {
      setMsg("Моля, въведи паролата си за потвърждение.");
      return;
    }
    setDeleting(true);
    try {
      await api.post("/me/delete-account", { password: deletePwd });
      setDeletePwd("");
      setDeleteOpen(false);
      logout();
      navigate("/catalog", { replace: true });
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Неуспешно изтриване на акаунта.");
    } finally {
      setDeleting(false);
    }
  };

  const avatarSrc = (() => {
    const url = profile?.avatar_url;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `http://localhost:4000${url}`;
  })();

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
            <div style={{ fontWeight: 950, fontSize: 18 }}>Профил</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ opacity: 0.85, fontSize: 13 }}>
                За да поръчаш, трябва да влезеш или да се регистрираш.
              </div>
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
              <>
                <div className="elite-grid-2">
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Име</span>
                    <input className="elite-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Фамилия</span>
                    <input className="elite-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </label>
                </div>

                <div className="elite-grid-2">
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Телефон</span>
                    <input className="elite-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359..." />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Държава</span>
                    <input className="elite-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Bulgaria" />
                  </label>
                </div>

                <div className="elite-grid-2">
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Град</span>
                    <input className="elite-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sofia" />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Адрес (за купувачи)</span>
                    <input className="elite-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. ..." />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>Роля</span>
                  <select className="elite-input" value={role} onChange={(e) => setRole(e.target.value as any)} onKeyDown={onEnterSubmit}>
                    <option value="buyer">Купувач</option>
                    <option value="creator">Създател (Creator)</option>
                  </select>
                </label>
              </>
            )}

            <button className="elite-btn primary" onClick={submit}>
              {mode === "login" ? "Влез" : "Създай профил"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="elite-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="elite-avatar"
              role={avatarSrc ? "button" : undefined}
              tabIndex={avatarSrc ? 0 : -1}
              onClick={() => {
                if (avatarSrc) setAvatarPreviewOpen(true);
              }}
              onKeyDown={(e) => {
                if (!avatarSrc) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAvatarPreviewOpen(true);
                }
              }}
              style={avatarSrc ? { cursor: "zoom-in" } : undefined}
              aria-label={avatarSrc ? "Отвори профилната снимка" : ""}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" />
              ) : (
                <div className="elite-avatar-fallback">{(profile?.full_name || user.email).slice(0, 1).toUpperCase()}</div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>
                {profile?.full_name || "Потребител"}
              </div>
              <div style={{ opacity: 0.85 }}>
                {user.email} • Роля: {roleLabel(user.role)}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="elite-btn" onClick={logout}>
              Изход
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className={`elite-tab ${panel === "purchased" && settingsTab === "overview" ? "active" : ""}`}
            onClick={() => { setPanelSafe("purchased"); setSettingsTab("overview"); }}
          >
            Моите курсове
          </button>

          <button
            className={`elite-tab ${panel === "purchased" && settingsTab === "profile" ? "active" : ""}`}
            onClick={() => { setPanelSafe("purchased"); setSettingsTab("profile"); }}
          >
            Настройки
          </button>

          <button
            className={`elite-tab ${panel === "purchased" && settingsTab === "security" ? "active" : ""}`}
            onClick={() => { setPanelSafe("purchased"); setSettingsTab("security"); }}
          >
            Сигурност
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

        {msg && (
          <div className="elite-note" style={{ marginTop: 12 }}>
            {msg}
          </div>
        )}
      </div>

      {panel === "purchased" && settingsTab === "overview" && <MyCourses />}

      {panel === "purchased" && settingsTab === "profile" && (
        <div className="elite-card">
          <h2 className="elite-h2">Профил и данни за купувач</h2>
          <p className="elite-muted">
            Телефон и адрес се използват за поддръжка и фактуриране (при нужда) и са свързани с профила на купувача.
          </p>

          <div className="elite-note" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <b>Профилна снимка</b>
                <div className="elite-muted">Качи или премахни снимка оттук. В чата се показва аватарът ти.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(f);
                    if (e.target) e.target.value = "";
                  }}
                />
                <button className="elite-btn" onClick={() => fileRef.current?.click()}>
                  {profile?.avatar_url ? "Смени снимката" : "Качи снимка"}
                </button>
                {profile?.avatar_url ? (
                  <button className="elite-btn ghost" onClick={removeAvatar}>
                    Премахни снимката
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="elite-form" style={{ marginTop: 14 }}>
            <label>
              <span>Име и фамилия</span>
              <input
                className="elite-input"
                value={profile?.full_name || ""}
                onChange={(e) => setProfile((p) => ({ ...(p || ({} as any)), full_name: e.target.value }))}
                placeholder="Напр. Lyudmila Pulova"
              />
            </label>

            <div className="elite-grid-2">
              <label>
                <span>Телефон</span>
                <input
                  className="elite-input"
                  value={profile?.phone || ""}
                  onChange={(e) => setProfile((p) => ({ ...(p || ({} as any)), phone: e.target.value }))}
                  placeholder="+359..."
                />
              </label>

              <label>
                <span>Държава</span>
                <input
                  className="elite-input"
                  value={profile?.country || ""}
                  onChange={(e) => setProfile((p) => ({ ...(p || ({} as any)), country: e.target.value }))}
                  placeholder="Bulgaria"
                />
              </label>
            </div>

            <div className="elite-grid-2">
              <label>
                <span>Град</span>
                <input
                  className="elite-input"
                  value={profile?.city || ""}
                  onChange={(e) => setProfile((p) => ({ ...(p || ({} as any)), city: e.target.value }))}
                  placeholder="Sofia"
                />
              </label>

              <label>
                <span>Адрес (billing / доставка)</span>
                <input
                  className="elite-input"
                  value={profile?.billing_address || ""}
                  onChange={(e) => setProfile((p) => ({ ...(p || ({} as any)), billing_address: e.target.value }))}
                  placeholder="ул. ..."
                />
              </label>
            </div>

            <button className="elite-btn primary" onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? "Запис..." : "Запази промените"}
            </button>
          </div>
        </div>
      )}

      {avatarPreviewOpen && avatarSrc ? (
        <div
          className="elite-modalOverlay"
          onClick={() => setAvatarPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="elite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="elite-modalHead">
              <div className="elite-modalTitle">Профилна снимка</div>
              <button className="elite-btn sm" onClick={() => setAvatarPreviewOpen(false)}>
                Затвори
              </button>
            </div>
            <div className="elite-modalBody">
              <img className="elite-modalImg" src={avatarSrc} alt="Profile avatar" />
            </div>
          </div>
        </div>
      ) : null}

      {panel === "purchased" && settingsTab === "security" && (
        <>
          <div className="elite-card">
            <h2 className="elite-h2">Смяна на парола</h2>
            <p className="elite-muted">За сигурност потвърди текущата парола и въведи нова.</p>

            <div className="elite-form" style={{ marginTop: 14 }}>
              <label>
                <span>Текуща парола</span>
                <input className="elite-input" type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} />
              </label>

              <div className="elite-grid-2">
                <label>
                  <span>Нова парола</span>
                  <input className="elite-input" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} />
                </label>

                <label>
                  <span>Потвърди новата парола</span>
                  <input className="elite-input" type="password" value={pwdNew2} onChange={(e) => setPwdNew2(e.target.value)} />
                </label>
              </div>

              <button className="elite-btn primary" onClick={changePassword} disabled={pwdSaving}>
                {pwdSaving ? "Запис..." : "Смени парола"}
              </button>
            </div>
          </div>

          <div className="elite-card" style={{ border: "1px solid rgba(255,0,0,0.25)" }}>
            <h2 className="elite-h2">Изтриване на профил</h2>
            <p className="elite-muted">
              Изтриването е необратимо. Ако имаш завършени поръчки, системата ще запази поръчките за отчетност, но ще
              анонимизира профила ти (email, профилни данни, чатове, снимка).
            </p>
            <button className="elite-btn" onClick={() => setDeleteOpen(true)}>
              Изтрий акаунта
            </button>
          </div>
        </>
      )}

      {deleteOpen ? (
        <div className="elite-modalOverlay" onClick={() => setDeleteOpen(false)} role="dialog" aria-modal="true">
          <div className="elite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="elite-modalHead">
              <div className="elite-modalTitle">Потвърди изтриване на акаунта</div>
              <button className="elite-btn sm" onClick={() => setDeleteOpen(false)}>
                Затвори
              </button>
            </div>
            <div className="elite-modalBody" style={{ display: "grid", gap: 10 }}>
              <div className="elite-note">
                Въведи паролата си, за да потвърдиш. След изтриване ще бъдеш изведена от профила.
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Парола</span>
                <input className="elite-input" type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="elite-btn ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                  Отказ
                </button>
                <button className="elite-btn primary" onClick={deleteAccount} disabled={deleting}>
                  {deleting ? "Изтриване..." : "Потвърди"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {panel === "create" && user.role !== "buyer" && <CreatorDashboard />}
      {panel === "created" && user.role !== "buyer" && <CreatedCourses />}
    </div>
  );
}
