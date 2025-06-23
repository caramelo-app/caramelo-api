require("dotenv").config();
const i18n = require("i18n");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const express = require("express");

const routes = require("./routes");
const { globalRateLimit, globalSlowDown } = require("./infra/middleware/rateLimiting");
const { connectDatabase } = require("./infra/database");
const { localize, i18nConfig } = require("./utils/localization.utils");
const { NotFoundError, InternalServerError } = require("./infra/errors");
const { envCheck } = require("./services/env.service");

// Check for required environment variables
envCheck();

// Configure i18n
i18n.configure(i18nConfig());

const app = express();

// Conectar ao MongoDB
connectDatabase().catch((error) => {
  console.error("Failed to connect to MongoDB:", error);
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(i18n.init);

// Apply global rate limiting and slow down (only in non-test environments)
if (process.env.NODE_ENV !== "test") {
  app.use(globalRateLimit);
  app.use(globalSlowDown);
}

// Rotas
app.use("/api", routes);

// Handler para rotas não encontradas (404)
app.use((req, res) => {
  const error = new NotFoundError({
    message: localize("error.generic.notFound", { resource: "URL" }),
    action: localize("error.infra.route.action"),
  });
  return res.status(error.status_code).json(error);
});

// Error handler
app.use((err, req, res) => {
  const error = new InternalServerError({
    cause: err,
  });
  return res.status(error.status_code).json(error);
});

const server = app.listen(process.env.SERVER_PORT, () => {
  console.log(`🟢 Server is running on port ${process.env.SERVER_PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("🟡 Shutting down gracefully...");

  // Close server
  server.close(() => {
    console.log("🔴 Server closed");
    process.exit(0);
  });
});

module.exports = app;
