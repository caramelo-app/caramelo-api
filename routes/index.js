const express = require("express");
const router = express.Router();

// Import all routes here
const userRouter = require("./user.route");
const userCreditsRouter = require("./user-credit.route");
const authRouter = require("./auth.route");
const companyRouter = require("./company.route");
const companyCardsRouter = require("./company-card.route");
const mockDataRouter = require("./mock-data.route");

router.use("/users", userRouter);
router.use("/user-credits", userCreditsRouter);
router.use("/auth", authRouter);
router.use("/companies", companyRouter);
router.use("/company-cards", companyCardsRouter);
router.use("/mock-data", mockDataRouter);

module.exports = router;