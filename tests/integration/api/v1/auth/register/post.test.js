const { fakerPT_BR: faker } = require("@faker-js/faker");

const dataUtils = require("utils/data.utils");
const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const passwordUtils = require("utils/password.utils");
const roleConstants = require("constants/roles.constants");
const statusConsts = require("constants/status.constants");
const datesConstants = require("constants/dates.constants");

const { addTime } = require("utils/date.utils");
const { localize } = require("utils/localization.utils");
const { validateToken } = require("utils/token.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

const userHandler = dbHandler(userModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/register`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/register", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the user is created correctly with status PENDING", async () => {
      const phone = dataUtils.generatePhoneNumber();
      const name = faker.person.fullName();
      const password = faker.internet.password();

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          name,
          password,
        }),
      });

      const responseBody = await response.json();

      await expect(response.status).toBe(200);
      await expect(responseBody.message).toBe(localize("auth.register.success"));

      // Load user to check the data
      const user = await userHandler.read({
        filter: { phone },
      });

      const validationExpirationDate = addTime(new Date(), 10, datesConstants.UNITS.MINUTE);

      await expect(user.name).toBe(name);
      await expect(user.phone).toBe(phone);
      await expect(user.status).toBe(statusConsts.RESOURCE_STATUS.PENDING);
      await expect(user.validation_token).toBeDefined();
      await expect(validateToken(user.validation_token)).toBe(true);
      await expect(user.validation_token_expires_at < validationExpirationDate).toBe(true);
      await expect(user.role).toBe(roleConstants.USER_ROLES.CONSUMER);

      // Check password
      const correctPasswordMatch = await passwordUtils.compare(password, user.password);

      await expect(correctPasswordMatch).toBe(true);
    });

    test("Should return 400 status when no phone is provided", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: faker.person.fullName(),
          password: faker.internet.password(),
        }),
      });

      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.message).toBe(localize("error.generic.required", { field: "phone" }));
      expect(responseBody.name).toBe("ValidationError");
    });

    test("Should return 400 status when no name is provided", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: dataUtils.generatePhoneNumber(),
          password: faker.internet.password(),
        }),
      });

      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.message).toBe(localize("error.generic.required", { field: "name" }));
      expect(responseBody.name).toBe("ValidationError");
    });

    test("Should return 400 status when no password is provided", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: dataUtils.generatePhoneNumber(),
          name: faker.person.fullName(),
        }),
      });

      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.message).toBe(localize("error.generic.required", { field: "password" }));
      expect(responseBody.name).toBe("ValidationError");
    });

    test("Should return 400 status when the phone is already in use", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, {
        status: [statusConsts.RESOURCE_STATUS.AVAILABLE],
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreatedOnMongo[0].phone,
          name: faker.person.fullName(),
          password: faker.internet.password(),
        }),
      });

      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.message).toBe(
        localize("error.generic.alreadyInUse", { field: "phone", value: user.documentsCreatedOnMongo[0].phone }),
      );
      expect(responseBody.name).toBe("ValidationError");
    });
  });
});
