const { param, body } = require("express-validator");

const { localize } = require("../utils/localization.utils");
const { validatePhone } = require("../utils/validation.utils");

function getCompaniesCards() {
  return [
    param("company_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "company_id" })),
  ];
}

function requestCard() {
  return [
    param("card_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "card_id" })),
  ];
}

function updateProfile() {
  return [
    body("name")
      .optional()
      .isString()
      .withMessage(localize("error.generic.required", { field: "name" })),
    body("email")
      .optional()
      .isEmail()
      .withMessage(localize("error.generic.required", { field: "email" })),
    body("phone")
      .optional()
      .isString()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .custom((value) => {
        if (value) {
          return validatePhone(value);
        }
        return true;
      }),
    body("password")
      .optional()
      .isString()
      .withMessage(localize("error.generic.required", { field: "password" })),
  ];
}

module.exports = {
  getCompaniesCards,
  requestCard,
  updateProfile,
};
