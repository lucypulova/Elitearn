// Entry point на приложението – стартира HTTP сървъра

require("dotenv").config(); // Зарежда променливите от .env

const { createApp } = require("./app"); // Импортира конфигурираното Express приложение

// Портът се взима от .env или по подразбиране 4000
const port = Number(process.env.PORT || 4000);

// Създаваме инстанция на Express app-а
const app = createApp();

// Стартираме сървъра
app.listen(port, () => {
  const provider = String(process.env.PAYMENT_PROVIDER || "test").toLowerCase();

  // Информационно съобщение при успешно стартиране
  console.log(`API running on http://localhost:${port} (provider=${provider})`);
});