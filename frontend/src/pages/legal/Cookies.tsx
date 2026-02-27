import { Link } from "react-router-dom";

export default function Cookies() {
  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Политика на бисквитките</h2>
        <p className="elite-muted">
          Elitearn използва бисквитки за основна функционалност и (по избор) аналитика/маркетинг.
          Можеш да управляваш предпочитанията си от настройките.
        </p>

        <Link className="elite-link" to="/cookies/settings">Настройки на бисквитките</Link>
      </div>
    </div>
  );
}
