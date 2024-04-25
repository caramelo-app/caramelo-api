const express = require("express");
const router = express.Router();

// Controllers
const UserCreditsController = require("../controllers/user-credit.controller");
const AuthController = require("../controllers/auth.controller");

// Consts
const roleConstants = require("../constants/roles.constants");

router.route("/").post(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    UserCreditsController.create);

router.route("/").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    UserCreditsController.list
);

router.route("/:id").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    UserCreditsController.read
);

router.route("/:id").patch(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    UserCreditsController.update
);

router.route("/:id").delete(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    UserCreditsController.delete
);

module.exports = router;