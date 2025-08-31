// app.js
require("dotenv").config();
const i18n = require("i18n");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./infra/swagger/swagger");

const routes = require("./routes");
const { globalRateLimit, globalSlowDown } = require("./infra/middleware/rateLimiting");
const { connectDatabase } = require("./infra/database");
const { localize, i18nConfig } = require("./utils/localization.utils");
const { NotFoundError, InternalServerError } = require("./infra/errors");
const { envCheck } = require("./services/env.service");

envCheck();

i18n.configure(i18nConfig());

const app = express();

let dbPromise;
async function ensureDb() {
  if (!dbPromise) dbPromise = connectDatabase();
  return dbPromise;
}
app.use(async (_req, _res, next) => {
  try { await ensureDb(); next(); } catch (e) { next(e); }
});

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(i18n.init);

if (process.env.NODE_ENV !== "test") {
  app.use(globalRateLimit);
  app.use(globalSlowDown);
}

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Caramelo API Documentation",
  })
);

const mountPath = process.env.VERCEL ? "/" : "/api";
app.use(mountPath, routes);

app.use((req, res) => {
  const error = new NotFoundError({
    message: localize("error.generic.notFound", { resource: "URL" }),
    action: localize("error.infra.route.action"),
  });
  return res.status(error.status_code).json(error);
});

app.use((err, _req, res, _next) => {
  const error = new InternalServerError({ cause: err });
  return res.status(error.status_code).json(error);
});

module.exports = app;
