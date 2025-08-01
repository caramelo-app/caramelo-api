const express = require("express");

const { generateLoadTestData } = require("../../controllers/loadtest.controller.js");

const router = express.Router();

router.post("/generate", generateLoadTestData);

module.exports = router;
