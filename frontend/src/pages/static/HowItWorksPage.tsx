export default function HowItWorks() {
  const steps = [
    { t: "1) Открий курс", d: "Филтрирай по категория/департамент и сравни съдържание, цена и формат." },
    { t: "2) Добави в кошница", d: "Събери нужните курсове и потвърди поръчката." },
    { t: "3) Плати сигурно", d: "Демо интеграция със Stripe (test mode) или симулиран провайдър." },
    { t: "4) Достъп веднага", d: "Курсът се появява в „Моите курсове“ и може да се използва веднага." },
  ];

  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Как работи Elitearn</h2>
        <p className="elite-muted">
          Elitearn комбинира каталог, кошница, плащания и достъп до курсове в един плавен поток.
        </p>

        <div className="elite-steps" style={{ marginTop: 14 }}>
          {steps.map((s) => (
            <div key={s.t} className="elite-step">
              <div className="elite-step-title">{s.t}</div>
              <div className="elite-muted">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
