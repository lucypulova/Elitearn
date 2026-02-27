// Връща стандартен 400 (Bad Request) JSON отговор
function sendBadRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

// Преобразува стойност в число или връща null,
// ако стойността е празна или невалидна
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Парсва списък от ID-та във формат "1,2,3"
// → връща масив от валидни числа
const parseIdList = (v) => {
  return String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
};

// Почиства име на файл за безопасно изтегляне
// Замества неразрешени символи с "_"
function safeDownloadName(name) {
  const base = String(name || "file").trim() || "file";
  return base.replace(/[^\w.\-()+ ]/g, "_");
}

// Генерира номер на поръчка във формат: ORD-YYYY-XXXXXX
function makeOrderNumber() {
  const yyyy = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 900000 + 100000);
  return `ORD-${yyyy}-${rnd}`;
}

// Преобразува сума (напр. 12.34) в стотинки (1234)
// Използва се при плащания (Stripe и др.)
function toCents(amount) {
  const n = Number(amount || 0);
  return Math.round(n * 100);
}

module.exports = {
  sendBadRequest,
  toIntOrNull,
  parseIdList,
  safeDownloadName,
  makeOrderNumber,
  toCents,
};