const express = require("express");

const authValidations = require("../../validators/auth.validations");
const {
  authRateLimit,
  createAccountRateLimit,
  passwordResetRateLimit,
  authSlowDown,
} = require("../../infra/middleware/rateLimiting");
const { requireGuest } = require("../../infra/middleware/auth.middleware");

const {
  login,
  forgotPassword,
  resetPassword,
  register,
  validateResetToken,
  validateRegisterToken,
} = require("../../controllers/auth.controller");
const { validateRouteRequest } = require("../../utils/validation.utils");

const router = express.Router();

router.use(requireGuest);

router.post("/login", authRateLimit, authSlowDown, authValidations.login(), validateRouteRequest, login);
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  authValidations.forgotPassword(),
  validateRouteRequest,
  forgotPassword,
);
router.post(
  "/reset-password",
  passwordResetRateLimit,
  authValidations.resetPassword(),
  validateRouteRequest,
  resetPassword,
);
router.post("/register", createAccountRateLimit, authValidations.register(), validateRouteRequest, register);
router.post(
  "/validate-reset-token",
  passwordResetRateLimit,
  authValidations.validateResetToken(),
  validateRouteRequest,
  validateResetToken,
);
router.post(
  "/validate-register-token",
  authRateLimit,
  authValidations.validateRegisterToken(),
  validateRouteRequest,
  validateRegisterToken,
);

module.exports = router;
