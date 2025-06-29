const express = require("express");

const segmentsController = require("../../controllers/segments.controller");
const { authenticatedUserRateLimit } = require("../../infra/middleware/rateLimiting");
const { requireAuth } = require("../../infra/middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, authenticatedUserRateLimit, segmentsController.getSegments);

module.exports = router;
