const express = require("express");

const { getCEP } = require("../../controllers/utils.controller.js");

const router = express.Router();

router.get("/cep", getCEP);

module.exports = router;
