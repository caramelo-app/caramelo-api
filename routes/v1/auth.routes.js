const express = require("express");


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


const router = express.Router();

router.use(requireGuest);

router.post("/login", authRateLimit, authSlowDown, login);
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  forgotPassword,
);
router.post(
  "/reset-password",
  passwordResetRateLimit,
  resetPassword,
);
router.post("/register", createAccountRateLimit, register);
router.post(
  "/validate-reset-token",
  passwordResetRateLimit,
  validateResetToken,
);
router.post(
  "/validate-register-token",
  authRateLimit,
  validateRegisterToken,
);

module.exports = router;
