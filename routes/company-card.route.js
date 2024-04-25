const express = require("express");
const router = express.Router();

// Controllers
const CompanyCardController = require("../controllers/company-card.controller");
const AuthController = require("../controllers/auth.controller");

// Consts
const roleConstants = require("../constants/roles.constants");

router.route("/").post(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyCardController.create);

router.route("/").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyCardController.list
);

router.route("/:id").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyCardController.read
);

router.route("/:id").patch(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyCardController.update
);

router.route("/:id").delete(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    CompanyCardController.delete
);

module.exports = router;