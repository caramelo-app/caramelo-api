const express = require("express");
const router = express.Router();

// Controllers
const CompanyController = require("../controllers/company.controller");
const AuthController = require("../controllers/auth.controller");

// Consts
const roleConstants = require("../constants/roles.constants");

router.route("/").post(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyController.create);

router.route("/trial-request").post(
    CompanyController.createTrialRequest
);

router.route("/").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyController.list
);

router.route("/consumers").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyController.listConsumers
);

router.route("/explore").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.CONSUMER
    ]),
    CompanyController.explore
);

router.route("/:id").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    CompanyController.read
);

router.route("/:id").patch(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyController.update
);

router.route("/:id").delete(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN
    ]),
    CompanyController.delete
);

module.exports = router;