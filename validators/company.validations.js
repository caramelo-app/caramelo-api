const { query, body, param } = require("express-validator");

const { localize } = require("../utils/localization.utils");

function exploreCompanies() {
  return [
    query("latitude")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "latitude" })),
    query("longitude")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "longitude" })),
    query("distance")
      .optional()
      .isInt()
      .withMessage(localize("error.generic.invalid", { field: "distance" })),
  ];
}

function updateCompanyProfile() {
  return [
    body("name")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "name" })),
    body("phone")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "phone" })),
    body("address")
      .optional()
      .isObject()
      .withMessage(localize("error.generic.invalid", { field: "address" })),
    body("logo")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "logo" })),
  ];
}

function getConsumerById() {
  return [
    param("consumer_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "consumer_id" })),
  ];
}

function createConsumer() {
  return [
    body("name")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "name" })),
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "phone" })),
    body("credits")
      .optional()
      .isArray()
      .withMessage(localize("error.generic.invalid", { field: "credits" })),
  ];
}

function updateConsumerCredits() {
  return [
    param("consumer_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "consumer_id" })),
    body("credits")
      .notEmpty()
      .isArray()
      .withMessage(localize("error.generic.required", { field: "credits" })),
  ];
}

function updateConsumer() {
  return [
    param("consumer_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "consumer_id" })),
    body("name")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "name" })),
    body("phone")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "phone" })),
  ];
}

function createCompanyCard() {
  return [
    body("title")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "title" })),
    body("credits_needed")
      .notEmpty()
      .isInt()
      .withMessage(localize("error.generic.required", { field: "credits_needed" })),
    body("credit_expires_at")
      .notEmpty()
      .isObject()
      .withMessage(localize("error.generic.required", { field: "credit_expires_at" })),
  ];
}

function getCompanyCardById() {
  return [
    param("card_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "card_id" })),
  ];
}

function updateCompanyCard() {
  return [
    param("card_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "card_id" })),
    body("title")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "title" })),
    body("credits_needed")
      .optional()
      .isInt()
      .withMessage(localize("error.generic.invalid", { field: "credits_needed" })),
    body("credit_expires_at")
      .optional()
      .isObject()
      .withMessage(localize("error.generic.invalid", { field: "credit_expires_at" })),
  ];
}

function updateCompanyCredit() {
  return [
    param("credit_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "credit_id" })),
    body("status")
      .notEmpty()
      .isString()
      .withMessage(localize("error.generic.required", { field: "status" })),
  ];
}

function getCompanyUserById() {
  return [
    param("user_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "user_id" })),
  ];
}

function updateCompanyUser() {
  return [
    param("user_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "user_id" })),
  ];
}

function deleteCompanyUser() {
  return [
    param("user_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "user_id" })),
  ];
}

function deleteConsumerCredit() {
  return [
    param("consumer_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "consumer_id" })),
    param("credit_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "credit_id" })),
  ];
}

function deleteConsumer() {
  return [
    param("consumer_id")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "consumer_id" })),
  ];
}

function createCompanyUser() {
  return [
    body("name")
      .optional()
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "name" })),
    body("phone")
      .notEmpty()
      .withMessage(localize("error.generic.required", { field: "phone" }))
      .isString()
      .withMessage(localize("error.generic.invalid", { field: "phone" })),
  ];
}

module.exports = {
  exploreCompanies,
  updateCompanyProfile,
  getConsumerById,
  createConsumer,
  updateConsumerCredits,
  updateConsumer,
  deleteConsumerCredit,
  deleteConsumer,
  createCompanyCard,
  getCompanyCardById,
  updateCompanyCard,
  updateCompanyCredit,
  getCompanyUserById,
  updateCompanyUser,
  deleteCompanyUser,
  createCompanyUser,
};
