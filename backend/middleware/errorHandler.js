// Middleware за несъществуващ маршрут (404)
function notFoundHandler(req, res) {
  // Ако няма съвпадащ route → връщаме 404
  res.status(404).json({ error: "Not found" });
}

// Централен middleware за грешки
function errorHandler(err, req, res, next) {
  // next не се използва, но е задължителен параметър за error middleware

  console.error(err); // логваме грешката на сървъра

  // Връщаме 500 без да разкриваме детайли (сигурност)
  res.status(500).json({ error: "Internal server error" });
}

module.exports = { notFoundHandler, errorHandler };