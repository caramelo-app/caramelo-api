const express = require("express");
const router = express.Router();

// Controllers
const UserController = require("../controllers/user.controller");
const AuthController = require("../controllers/auth.controller");

// Consts
const roleConstants = require("../constants/roles.constants");

router.route("/").post(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    UserController.create);

router.route("/").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT
    ]),
    UserController.list
);

router.route("/:id").get(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    UserController.read
);

router.route("/:id").patch(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    UserController.update
);

router.route("/:id").delete(
    AuthController.authenticate,
    AuthController.authorize([
        roleConstants.USER_ROLES.ADMIN,
        roleConstants.USER_ROLES.CLIENT,
        roleConstants.USER_ROLES.CONSUMER
    ]),
    UserController.delete
);

module.exports = router;