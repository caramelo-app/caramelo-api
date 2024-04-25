const express = require("express");
const router = express.Router();

// Import all routes here
var userRouter = require("./user.route");
var userCreditsRouter = require("./user-credit.route");
var authRouter = require("./auth.route");
var companyRouter = require("./company.route");
var companyCardsRouter = require("./company-card.route");

router.use("/users", userRouter);
router.use("/user-credits", userCreditsRouter);
router.use("/auth", authRouter);
router.use("/companies", companyRouter);
router.use("/company-cards", companyCardsRouter);

module.exports = router;