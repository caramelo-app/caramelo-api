const express = require("express");

const { health } = require("../../controllers/health.controller.js");

const router = express.Router();

router.get("/", health);

module.exports = router;
