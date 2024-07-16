const express = require("express");
const router = express.Router();

// Controllers
const MockDataController = require("../controllers/mock-data.controller");

router.route("/populate").post(MockDataController.populateDummyData);

module.exports = router;