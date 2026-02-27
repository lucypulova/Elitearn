import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Връзка с нас</h2>
        <p className="elite-muted">
          Демонстрационна страница за проекта. В production вариант тук би имало тикет система или email gateway.
        </p>

        {sent ? (
          <div className="elite-note ok" style={{ marginTop: 12 }}>
            Съобщението е изпратено (demo).
          </div>
        ) : null}

        <div className="elite-form" style={{ marginTop: 14 }}>
          <label>
            <span>Тема</span>
            <input className="elite-input" placeholder="Напр. Проблем с плащане" />
          </label>
          <label>
            <span>Имейл за обратна връзка</span>
            <input className="elite-input" placeholder="email@domain.com" />
          </label>
          <label>
            <span>Съобщение</span>
            <textarea className="elite-input" rows={5} placeholder="Опиши случая възможно най-детайлно..." />
          </label>

          <button className="elite-btn primary" onClick={() => setSent(true)}>
            Изпрати
          </button>
        </div>
      </div>
    </div>
  );
}
