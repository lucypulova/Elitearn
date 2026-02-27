import { useEffect, useState } from "react";

type CookiePrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const KEY = "elitearn_cookie_prefs";

export default function CookieSettings() {
  const [prefs, setPrefs] = useState<CookiePrefs>({ necessary: true, analytics: false, marketing: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setPrefs({
        necessary: true,
        analytics: !!parsed.analytics,
        marketing: !!parsed.marketing,
      });
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Настройки на бисквитките</h2>
        <p className="elite-muted">
          Контролирай кои категории бисквитки са разрешени. Necessary са задължителни за работа на сайта.
        </p>

        {saved ? <div className="elite-note ok" style={{ marginTop: 12 }}>Запазено.</div> : null}

        <div className="elite-form" style={{ marginTop: 14 }}>
          <div className="elite-switch-row">
            <div>
              <div style={{ fontWeight: 800 }}>Necessary</div>
              <div className="elite-muted">Задължителни за вход, сигурност и основна функционалност.</div>
            </div>
            <input type="checkbox" checked readOnly />
          </div>

          <div className="elite-switch-row">
            <div>
              <div style={{ fontWeight: 800 }}>Analytics</div>
              <div className="elite-muted">Аналитични бисквитки за подобряване на продукта.</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.analytics}
              onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
            />
          </div>

          <div className="elite-switch-row">
            <div>
              <div style={{ fontWeight: 800 }}>Marketing</div>
              <div className="elite-muted">Маркетингови бисквитки за персонализирани кампании.</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.marketing}
              onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
            />
          </div>

          <button className="elite-btn primary" onClick={save}>Запази предпочитания</button>
        </div>
      </div>
    </div>
  );
}
