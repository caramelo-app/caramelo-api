const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const datesConstants = require("constants/dates.constants");

const { subTime } = require("utils/date.utils");
const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

const userHandler = dbHandler(userModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/validate-reset-token`;
const forgotPasswordEndpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/forgot-password`;

let user;
let user2;

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

  // forgot password logic
  await fetch(forgotPasswordEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: user.documentsCreatedOnMongo[0].phone,
    }),
  });
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/validate-reset-token", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the token is valid", async () => {
      const readUserOptions = {
        filter: { _id: user.documentsCreatedOnMongo[0]._id },
        projection: { validation_token: 1, validation_token_expires_at: 1 },
      };
      const userFromDb = await userHandler.read(readUserOptions);

      await expect(userFromDb.validation_token).toBeDefined();

      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: userFromDb.validation_token,
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      // Check user after
      const userFromDbAfter = await userHandler.read(readUserOptions);

      await expect(validateResetTokenResponse.status).toBe(200);
      await expect(validateResetTokenBody.message).toBe(localize("auth.validateResetToken.success"));
      await expect(userFromDbAfter.validation_token).toBeNull();
      await expect(userFromDbAfter.validation_token_expires_at).toBeNull();
    });

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
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(400);
      await expect(validateResetTokenBody.name).toBe("ValidationError");
      await expect(validateResetTokenBody.message).toBe(localize("error.generic.required", { field: "phone" }));
    });

    test("Should return 401 status when the token is invalid", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "99999",
          phone: user.documentsCreatedOnMongo[0].phone,
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
  });
});
