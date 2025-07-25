const userModel = require("models/user.model");
const companyModel = require("models/company.model");
const cardModel = require("models/card.model");
const creditModel = require("models/credit.model");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");
const { localize } = require("utils/localization.utils");

// Handlers
const userHandler = dbHandler(userModel);
const companyHandler = dbHandler(companyModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/consumers`;

const { connectDatabase, disconnectDatabase } = require("infra/database");

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

describe("POST /v1/companies/consumers/{consumer_id}/cards/{card_id}/redeem", () => {
  describe("Success cases", () => {
    test("Should return 200 status when redeeming card benefits successfully", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          excluded: false,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
          excluded: false,
        },
      ]);

      const consumer = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          role: roleConstants.USER_ROLES.CONSUMER,
          excluded: false,
        },
      ]);

      const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
        {
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          credits_needed: 3,
          excluded: false,
        },
      ]);

      // Create exactly the number of credits needed
      await orchestrator.createDocumentOnMongo(3, creditHandler, [
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(
        `${endpoint}/${consumer.documentsCreatedOnMongo[0]._id}/cards/${card.documentsCreatedOnMongo[0]._id}/redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe(localize("companies.consumers.redeem.success"));
      expect(body.redeemedCredits).toBe(3);
      expect(body.cardTitle).toBe(card.documentsCreatedOnMongo[0].title);

      // Verify credits were updated to USED status
      const updatedCredits = await creditHandler.list({
        filter: {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.USED,
        },
      });

      expect(updatedCredits.length).toBe(3);
      expect(updatedCredits.every((credit) => credit.requested_at)).toBe(true);
    });

    test("Should return 200 status when redeeming with more credits than needed (uses oldest first)", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const consumer = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          role: roleConstants.USER_ROLES.CONSUMER,
        },
      ]);

      const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
        {
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          credits_needed: 2,
        },
      ]);

      // Create more credits than needed
      await orchestrator.createDocumentOnMongo(5, creditHandler, [
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
          excluded: false,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(
        `${endpoint}/${consumer.documentsCreatedOnMongo[0]._id}/cards/${card.documentsCreatedOnMongo[0]._id}/redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.redeemedCredits).toBe(2);

      // Verify only 2 credits were used (oldest first)
      const usedCredits = await creditHandler.list({
        filter: {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.USED,
        },
      });

      const availableCredits = await creditHandler.list({
        filter: {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
        },
      });

      expect(usedCredits.length).toBe(2);
      expect(availableCredits.length).toBe(3);
    });
  });

  describe("Error cases", () => {
    test("Should return 400 status when insufficient credits", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const consumer = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          role: roleConstants.USER_ROLES.CONSUMER,
        },
      ]);

      const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
        {
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          credits_needed: 5,
        },
      ]);

      // Create fewer credits than needed
      await orchestrator.createDocumentOnMongo(2, creditHandler, [
        {
          user_id: consumer.documentsCreatedOnMongo[0]._id,
          card_id: card.documentsCreatedOnMongo[0]._id,
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.CREDITS_STATUS.AVAILABLE,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(
        `${endpoint}/${consumer.documentsCreatedOnMongo[0]._id}/cards/${card.documentsCreatedOnMongo[0]._id}/redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.name).toBe("ValidationError");
    });

    test("Should return 401 status when the user is excluded", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          excluded: true,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(`${endpoint}/fake-consumer-id/cards/fake-card-id/redeem`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.name).toBe("UnauthorizedError");
      expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
      expect(body.action).toBe(localize("error.UnauthorizedError.action"));
    });

    test("Should return 401 status when the user is not available", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.PENDING,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(`${endpoint}/fake-consumer-id/cards/fake-card-id/redeem`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.name).toBe("UnauthorizedError");
      expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
      expect(body.action).toBe(localize("error.UnauthorizedError.action"));
    });

    test("Should return 403 status when consumer not found", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
        {
          company_id: company.documentsCreatedOnMongo[0]._id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(
        `${endpoint}/507f1f77bcf86cd799439011/cards/${card.documentsCreatedOnMongo[0]._id}/redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.name).toBe("ForbiddenError");
    });

    test("Should return 403 status when card not found", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
          role: roleConstants.USER_ROLES.CLIENT,
        },
      ]);

      const consumer = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          role: roleConstants.USER_ROLES.CONSUMER,
        },
      ]);

      const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
      });

      const loginBody = await loginResponse.json();
      const token = loginBody.accessToken;

      const response = await fetch(
        `${endpoint}/${consumer.documentsCreatedOnMongo[0]._id}/cards/507f1f77bcf86cd799439011/redeem`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.name).toBe("ForbiddenError");
    });
  });
});
