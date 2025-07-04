const express = require("express");

const { getCEP, getCoordinates } = require("../../controllers/utils.controller.js");

const router = express.Router();

router.get("/cep", getCEP);
router.get("/coordinates", getCoordinates);

module.exports = router;
