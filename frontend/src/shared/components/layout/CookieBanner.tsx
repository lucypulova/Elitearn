import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type CookiePrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const KEY = "elitearn_cookie_prefs";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) setOpen(true);
  }, []);

  const save = (prefs: CookiePrefs) => {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="elite-cookie">
      <div className="elite-cookie-inner">
        <div>
          <div className="elite-cookie-title">Бисквитки</div>
          <div className="elite-muted" style={{ marginTop: 4 }}>
            Използваме бисквитки за основна функционалност. Можеш да разрешиш и аналитични/маркетингови.
            <span style={{ marginLeft: 6 }}>
              <Link className="elite-link" to="/legal/cookies">Политика</Link>
            </span>
          </div>
        </div>

        <div className="elite-cookie-actions">
          <button className="elite-btn" onClick={() => save({ necessary: true, analytics: false, marketing: false })}>
            Само нужни
          </button>
          <button className="elite-btn" onClick={() => save({ necessary: true, analytics: true, marketing: false })}>
            Разреши аналитични
          </button>
          <button className="elite-btn primary" onClick={() => save({ necessary: true, analytics: true, marketing: true })}>
            Приеми всички
          </button>
          <Link className="elite-btn ghost" to="/cookies/settings" onClick={() => setOpen(false)}>
            Настройки
          </Link>
        </div>
      </div>
    </div>
  );
}
