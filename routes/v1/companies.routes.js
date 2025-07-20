const express = require("express");


const companyController = require("../../controllers/companies.controller");
const { creditOperationsRateLimit, authenticatedUserRateLimit } = require("../../infra/middleware/rateLimiting");
const {
  requireAuth,
  requireClient,
  requireConsumer,
  requireCompanyAccess,
} = require("../../infra/middleware/auth.middleware");

const router = express.Router();

router.get(
  "/explore",
  requireAuth,
  requireConsumer,
  authenticatedUserRateLimit,
  companyController.exploreCompanies,
);

router.use(requireAuth);
router.use(requireClient);
router.use(requireCompanyAccess);
router.use(authenticatedUserRateLimit);

router.get("/stats", companyController.getCompanyStats);
router.get("/profile", companyController.getCompanyProfile);
router.patch("/profile", companyController.updateCompanyProfile);
router.get("/consumers", companyController.getConsumers);
router.post(
  "/consumers",
  creditOperationsRateLimit,
  companyController.createConsumer,
);
router.get("/consumers/:consumer_id", companyController.getConsumerById);
router.patch("/consumers/:consumer_id", companyController.updateConsumer);
router.delete("/consumers/:consumer_id", companyController.deleteConsumer);
router.patch(
  "/consumers/:consumer_id/credits",
  creditOperationsRateLimit,
  companyController.updateConsumerCredits,
);
router.delete(
  "/consumers/:consumer_id/credits/:credit_id",
  companyController.deleteConsumerCredit,
);
router.get("/cards", companyController.getCompanyCards);
router.get("/cards/:card_id", companyController.getCompanyCardById);
router.post("/cards", companyController.createCompanyCard);
router.patch("/cards/:card_id", companyController.updateCompanyCard);
router.delete("/cards/:card_id", companyController.deleteCompanyCard);
router.get("/credits", companyController.getCompanyCredits);
router.patch("/credits/:credit_id", companyController.updateCompanyCredit);
router.get("/users", companyController.getCompanyUsers);
router.get("/users/:user_id", companyController.getCompanyUserById);
router.post("/users", companyController.createCompanyUser);
router.patch("/users/:user_id", companyController.updateCompanyUser);
router.delete("/users/:user_id", companyController.deleteCompanyUser);

module.exports = router;
