const express = require("express");

const v1Routes = require("./v1");
const controller = require("../infra/controller");

const router = express.Router();

router.use("/v1", v1Routes);

// 404 - route not found handler
router.use(controller.errorHandlers.onNoMatch);

// global error handler
router.use(controller.errorHandlers.onError);

module.exports = router;
