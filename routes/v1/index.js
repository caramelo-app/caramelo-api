const express = require("express");

const router = express.Router();
const { ping } = require("../../controllers/health.controller.js");

router.use("/auth", require("./auth.routes.js"));
router.use("/companies", require("./companies.routes.js"));
router.use("/health", require("./health.routes.js"));
router.use("/loadtest", require("./loadtest.routes.js"));
router.use("/segments", require("./segments.routes.js"));
router.use("/users", require("./users.routes.js"));
router.use("/utils", require("./utils.routes.js"));
router.get("/ping", ping);

module.exports = router;
