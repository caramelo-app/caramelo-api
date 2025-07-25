const express = require("express");

const { getCEP, getCoordinates, getRandomAddresses } = require("../../controllers/utils.controller.js");

const router = express.Router();

router.get("/cep", getCEP);
router.get("/coordinates", getCoordinates);
router.get("/places", getRandomAddresses);

module.exports = router;
