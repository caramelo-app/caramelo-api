const express = require("express");

const router = express.Router();

router.use("/auth", require("./auth.routes.js"));
router.use("/companies", require("./companies.routes.js"));
router.use("/health", require("./health.routes.js"));
router.use("/users", require("./users.routes.js"));
router.use("/utils", require("./utils.routes.js"));

module.exports = router;
