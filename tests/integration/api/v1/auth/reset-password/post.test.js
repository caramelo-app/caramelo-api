const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const passwordUtils = require("utils/password.utils");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const datesConstants = require("constants/dates.constants");

const { localize } = require("utils/localization.utils");
const { subTime, addTime } = require("utils/date.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

const userHandler = dbHandler(userModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/reset-password`;

let user;
let user2;
let user3;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();

  user = await orchestrator.createDocumentOnMongo(1, userHandler, [
    {
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
    },
  ]);
  user2 = await orchestrator.createDocumentOnMongo(1, userHandler, [
    {
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      validation_token: "12345",
      validation_token_expires_at: subTime(new Date(), 2, datesConstants.UNITS.HOUR),
    },
  ]);
  user3 = await orchestrator.createDocumentOnMongo(1, userHandler, [
    {
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      validation_token: "12345",
      validation_token_expires_at: addTime(new Date(), 10, datesConstants.UNITS.MINUTE),
    },
  ]);
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/reset-password", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the password is reset successfully", async () => {
      const resetPasswordResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user3.documentsCreatedOnMongo[0].phone,
          token: user3.documentsCreatedOnMongo[0].validation_token,
          password: "newPassword",
        }),
      });

      const resetPasswordBody = await resetPasswordResponse.json();

      // Load user to get new password hashed
      const response = await userHandler.read({
        filter: { phone: user3.documentsCreatedOnMongo[0].phone },
        projection: { password: 1 },
      });

      const correctPasswordMatch = await passwordUtils.compare("newPassword", response.password);

      await expect(resetPasswordResponse.status).toBe(200);
      await expect(resetPasswordBody.message).toBe(localize("auth.resetPassword.success"));
      await expect(correctPasswordMatch).toBe(true);
    }, 100000);

    test("Should return 400 status when the token is missing", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.required", { field: "token" }));
    });

    test("Should return 400 status when the phone is missing", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345",
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.required", { field: "phone" }));
    });

    test("Should return 400 status when the password is missing", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345",
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.required", { field: "password" }));
    });

    test("Should return 401 status when the token doesn't match", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "99999",
          phone: user.documentsCreatedOnMongo[0].phone,
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(401);
      await expect(validateResetTokenBody.name).toBe("UnauthorizedError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.invalid", { field: "token" }));
    });

    test("Should return 401 status when the token is expired", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user2.documentsCreatedOnMongo[0].validation_token,
          phone: user2.documentsCreatedOnMongo[0].phone,
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(401);
      await expect(validateResetTokenBody.name).toBe("UnauthorizedError");
      await expect(validateResetTokenBody.message).toBe(localize("error.auth.token.expired"));
    });

    test("Should return 401 status when the user is not found", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345",
          phone: "5599999999999",
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(401);
      await expect(validateResetTokenBody.name).toBe("UnauthorizedError");
      await expect(validateResetTokenBody.message).toBe(
        localize("error.generic.notFound", { resource: localize("resources.user") }),
      );
      await expect(validateResetTokenBody.action).toBe(
        localize("error.generic.notFoundActionMessage", { resource: localize("resources.user").toLowerCase() }),
      );
    });

    test("Should return 400 status when the token format is invalid", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "1",
          phone: user.documentsCreatedOnMongo[0].phone,
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.invalidFormat", { field: "token" }));
    });

    test("Should return 400 status when the phone format is invalid", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345",
          phone: "1",
          password: "newPassword",
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.invalidFormat", { field: "phone" }));
    });
  });
});
