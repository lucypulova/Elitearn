export default function Tips() {
  const tips = [
    "Преди покупка прегледай съдържанието на курса и нивото (начинаещ/средно/напреднал).",
    "Запази любими курсове, за да ги сравниш по-късно.",
    "Поддържай профила си актуален – телефон и адрес подпомагат поддръжката и документирането.",
    "Сменяй паролата периодично и използвай силна парола.",
  ];

  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Съвети</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, marginTop: 10 }}>
          {tips.map((t) => (
            <li key={t} className="elite-muted">{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
