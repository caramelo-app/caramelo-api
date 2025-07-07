const express = require("express");

const companyValidations = require("../../validators/company.validations");
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
  companyValidations.exploreCompanies(),
  requireAuth,
  requireConsumer,
  authenticatedUserRateLimit,
  companyController.exploreCompanies,
);

router.use(requireAuth);
router.use(requireClient);
router.use(requireCompanyAccess);
router.use(authenticatedUserRateLimit);

router.get("/profile", companyController.getCompanyProfile);
router.patch("/profile", companyValidations.updateCompanyProfile(), companyController.updateCompanyProfile);
router.get("/consumers", companyController.getConsumers);
router.post(
  "/consumers",
  companyValidations.createConsumer(),
  creditOperationsRateLimit,
  companyController.createConsumer,
);
router.get("/consumers/:consumer_id", companyValidations.getConsumerById(), companyController.getConsumerById);
router.patch(
  "/consumers/:consumer_id/credits",
  creditOperationsRateLimit,
  companyValidations.updateConsumerCredits(),
  companyController.updateConsumerCredits,
);
router.get("/cards", companyController.getCompanyCards);
router.post("/cards", companyValidations.createCompanyCard(), companyController.createCompanyCard);
router.patch("/cards/:card_id", companyValidations.updateCompanyCard(), companyController.updateCompanyCard);
router.delete("/cards/:card_id", companyController.deleteCompanyCard);
router.get("/credits", companyController.getCompanyCredits);
router.patch("/credits/:credit_id", companyValidations.updateCompanyCredit(), companyController.updateCompanyCredit);
router.get("/users", companyController.getCompanyUsers);
router.get("/users/:user_id", companyController.getCompanyUserById);

module.exports = router;
