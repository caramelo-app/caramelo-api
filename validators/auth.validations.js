const { body } = require("express-validator");

const { validateToken } = require("../utils/token.utils");
const { localize } = require("../utils/localization.utils");
const { validatePhone } = require("../utils/validation.utils");

function login() {
  return [
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
    body("password")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "password" })),
  ];
}

function forgotPassword() {
  return [
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
  ];
}

function validateResetToken() {
  return [
    body("token")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "token" }))
      .custom(tokenValidator),
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
  ];
}

function resetPassword() {
  return [
    body("token")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "token" }))
      .custom(tokenValidator),
    body("password")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "password" })),
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
  ];
}

function register() {
  return [
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
    body("name")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "name" })),
    body("password")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "password" })),
  ];
}

function validateRegisterToken() {
  return [
    body("token")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "token" }))
      .custom(tokenValidator),
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom(phoneValidator),
  ];
}

// Check for the phone number format is great because we dont need to hit database if the format is invalid
// It can save us resources at long-term
function phoneValidator(value) {
  if (!validatePhone(value)) {
    throw new Error(localize("error.generic.invalidFormat", { field: "phone" }));
  }
  return true;
}

function tokenValidator(value) {
  if (!validateToken(value)) {
    throw new Error(localize("error.generic.invalidFormat", { field: "token" }));
  }
  return true;
}

module.exports = {
  login,
  forgotPassword,
  validateResetToken,
  resetPassword,
  register,
  validateRegisterToken,
};
