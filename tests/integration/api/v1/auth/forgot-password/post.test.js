const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const datesConstants = require("constants/dates.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");
const { validateToken } = require("utils/token.utils");
const { addTime } = require("utils/date.utils");
const { generatePhoneNumber } = require("utils/data.utils");

const userHandler = dbHandler(userModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/forgot-password`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/forgot-password", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the user is authenticated correctly and sent the SMS with the token", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreatedOnMongo[0].phone,
        }),
      });

      const body = await response.json();

      const userOptions = {
        filter: { _id: user.documentsCreatedOnMongo[0]._id },
        projection: { validation_token: 1, validation_token_expires_at: 1 },
      };
      const userFromDb = await userHandler.read(userOptions);

      const validationExpirationDate = addTime(new Date(), 10, datesConstants.UNITS.MINUTE);

      await expect(response.status).toBe(200);
      await expect(body.message).toBe(localize("auth.forgotPassword.success"));
      await expect(userFromDb.validation_token).toBeDefined();
      await expect(validateToken(userFromDb.validation_token)).toBe(true);
      await expect(userFromDb.validation_token_expires_at).toBeDefined();
      await expect(userFromDb.validation_token_expires_at).toBeInstanceOf(Date);
      await expect(userFromDb.validation_token_expires_at < validationExpirationDate).toBe(true);
    });

    test("Should return 401 status when the user is not found", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: generatePhoneNumber(),
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(401);
      await expect(body.name).toBe("UnauthorizedError");
      await expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.user") }));
      await expect(body.action).toBe(
        localize("error.generic.notFoundActionMessage", { resource: localize("resources.user").toLowerCase() }),
      );
    });

    test("Should return 400 status when the phone is invalid", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: "55419840128" }),
      });

      const body = await response.json();

      await expect(response.status).toBe(400);
      await expect(body.name).toBe("ValidationError");
      await expect(body.message).toBe(localize("error.generic.invalidFormat", { field: "phone" }));
    });
  });
});
