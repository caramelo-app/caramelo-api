const dataUtils = require("utils/data.utils");
const userModel = require("models/user.model");
const tokenUtils = require("utils/token.utils");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const datesConstants = require("constants/dates.constants");

const { localize } = require("utils/localization.utils");
const { subTime, addTime } = require("utils/date.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

const userHandler = dbHandler(userModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/validate-register-token`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/validate-register-token", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the token is valid", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          phone: dataUtils.generatePhoneNumber(),
          validation_token: tokenUtils.generateToken(),
          validation_token_expires_at: addTime(new Date(), 10, datesConstants.UNITS.MINUTE),
        },
      ]);

      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user.documentsCreatedOnMongo[0].validation_token,
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      const userFromDb = await userHandler.read({
        filter: { _id: user.documentsCreatedOnMongo[0]._id },
        projection: { status: 1, validation_token: 1, validation_token_expires_at: 1 },
      });

      await expect(validateResetTokenResponse.status).toBe(200);
      await expect(validateResetTokenBody.message).toBe(localize("auth.validateResetToken.success"));
      await expect(userFromDb.status).toBe(statusConsts.RESOURCE_STATUS.AVAILABLE);
      await expect(userFromDb.validation_token).toBeNull();
      await expect(userFromDb.validation_token_expires_at).toBeNull();
    });

    test("Should return 400 status when the token is missing", async () => {
      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: dataUtils.generatePhoneNumber(),
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
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          validation_token_expires_at: addTime(new Date(), 10, datesConstants.UNITS.MINUTE),
        },
      ]);

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
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          validation_token: tokenUtils.generateToken(),
          validation_token_expires_at: subTime(new Date(), 2, datesConstants.UNITS.HOUR),
        },
      ]);

      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user.documentsCreatedOnMongo[0].validation_token,
          phone: user.documentsCreatedOnMongo[0].phone,
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

    test("Should return 401 status when the user is not in PENDING status", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          validation_token: tokenUtils.generateToken(),
          validation_token_expires_at: addTime(new Date(), 10, datesConstants.UNITS.MINUTE),
        },
      ]);

      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user.documentsCreatedOnMongo[0].validation_token,
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const validateResetTokenBody = await validateResetTokenResponse.json();

      await expect(validateResetTokenResponse.status).toBe(401);
      await expect(validateResetTokenBody.name).toBe("UnauthorizedError");
      await expect(validateResetTokenBody.message).toBe(
        localize("error.generic.notFound", { resource: localize("resources.user") }),
      );
    });

    test("Should return 401 status when the user is excluded", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          validation_token: tokenUtils.generateToken(),
          validation_token_expires_at: addTime(new Date(), 10, datesConstants.UNITS.MINUTE),
          excluded: true,
        },
      ]);

      const validateResetTokenResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user.documentsCreatedOnMongo[0].validation_token,
          phone: user.documentsCreatedOnMongo[0].phone,
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
