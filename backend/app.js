// Създава и конфигурира Express приложението

const express = require("express");
const cors = require("cors");

const { ensureUploadsReady, uploadsStaticMiddleware } = require("./config/uploads");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Импортиране на всички route модули
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const privateRouter = require("./routes/private");
const profileRouter = require("./routes/profile");
const catalogRouter = require("./routes/catalog");
const assetsRouter = require("./routes/assets");
const cartRouter = require("./routes/cart");
const ordersRouter = require("./routes/orders");
const creatorRouter = require("./routes/creator");
const adminRouter = require("./routes/admin");
const chatRouter = require("./routes/chat");
const searchRouter = require("./routes/search");

function createApp() {
  // Подготвя папката за качени файлове (ако не съществува)
  ensureUploadsReady();

  const app = express();

  // Глобални middleware-и
  app.use(cors());            // Позволява CORS заявки
  app.use(express.json());    // Парсва JSON body

  // Статичен достъп до качени файлове
  app.use("/uploads", uploadsStaticMiddleware());

  // ---------------------------
  // Регистриране на router-и
  // ---------------------------
  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", privateRouter);
  app.use("/api/me", profileRouter);
  app.use("/api", catalogRouter);
  app.use("/api", assetsRouter);
  app.use("/api", cartRouter);
  app.use("/api", ordersRouter);
  app.use("/api", creatorRouter);
  app.use("/api", adminRouter);
  app.use("/api", chatRouter);
  app.use("/api", searchRouter);

  // 404 handler (ако няма съвпадащ route)
  app.use(notFoundHandler);

  // Централен error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };