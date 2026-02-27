import { Link } from "react-router-dom";

export default function Help() {
  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Help Center</h2>
        <p className="elite-muted">
          Тук ще намериш бързи отговори, полезни насоки и връзка с екипа на Elitearn.
        </p>

        <div className="elite-grid-3" style={{ marginTop: 14 }}>
          <div className="elite-mini-card">
            <div className="elite-mini-title">Често задавани въпроси</div>
            <div className="elite-muted">Отговори на най-често срещаните въпроси.</div>
            <Link className="elite-link" to="/faq">Виж FAQs</Link>
          </div>
          <div className="elite-mini-card">
            <div className="elite-mini-title">Как работи</div>
            <div className="elite-muted">Как се купуват курсове, достъп и сертификати.</div>
            <Link className="elite-link" to="/how-it-works">Отвори</Link>
          </div>
          <div className="elite-mini-card">
            <div className="elite-mini-title">Връзка с нас</div>
            <div className="elite-muted">Пиши ни и ще съдействаме.</div>
            <Link className="elite-link" to="/contact">Контакт</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
