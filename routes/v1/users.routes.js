const express = require("express");

const userController = require("../../controllers/users.controller");
const userValidations = require("../../validators/user.validations");
const { creditOperationsRateLimit, authenticatedUserRateLimit } = require("../../infra/middleware/rateLimiting");
const { requireAuth, requireConsumer } = require("../../infra/middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);
router.use(requireConsumer);
router.use(authenticatedUserRateLimit);
router.get("/cards", userController.getCards);
router.get("/cards/companies/:company_id/list", userValidations.getCompaniesCards(), userController.getCompaniesCards);
router.post(
  "/cards/:card_id/request",
  creditOperationsRateLimit,
  userValidations.requestCard(),
  userController.requestCard,
);
router.get("/profile", userController.getProfile);
router.patch("/profile", userValidations.updateProfile(), userController.updateProfile);
router.delete("/profile", userController.cancelAccount);

module.exports = router;
