const express = require("express");

const { ForbiddenError } = require("../../infra/errors");
const { localize } = require("../../utils/localization.utils");
const roleConstants = require("../../constants/roles.constants");
const userController = require("../../controllers/users.controller");

const { requireAuth, requireConsumer } = require("../../infra/middleware/auth.middleware");
const { creditOperationsRateLimit, authenticatedUserRateLimit } = require("../../infra/middleware/rateLimiting");

const requireConsumerOrClient = (req, res, next) => {
  if (req.user.role === roleConstants.USER_ROLES.CONSUMER || req.user.role === roleConstants.USER_ROLES.CLIENT) {
    return next();
  }
  return next(
    new ForbiddenError({
      message: localize("error.ForbiddenError.message"),
    }),
  );
};

const router = express.Router();

router.use(requireAuth);
router.use(authenticatedUserRateLimit);
router.get("/cards", requireConsumer, userController.getCards);
router.get(
  "/cards/companies/:company_id/list",
  requireConsumer,
  userController.getCompaniesCards,
);
router.post(
  "/cards/:card_id/request",
  requireConsumer,
  creditOperationsRateLimit,
  userController.requestCard,
);
router.get("/profile", requireConsumer, userController.getProfile);
router.patch("/profile", requireConsumer, userController.updateProfile);
router.delete("/profile", requireConsumerOrClient, userController.cancelAccount);

module.exports = router;
