const express = require("express");
const router = express.Router();

// Controllers
const AuthController = require("../controllers/auth.controller");

router.route("/signin").post(AuthController.signin);
router.route("/signup").post(AuthController.signup);
router.route("/validate-account").post(AuthController.validateAccount);
router.route("/forgot-password").post(AuthController.forgotPassword);
router.route("/forgot-password-validate-account").post(AuthController.forgotPasswordValidation);
router.route("/reset-password").post(AuthController.resetPassword);
router.route("/get-user-data").get(AuthController.getUserData);

module.exports = router;