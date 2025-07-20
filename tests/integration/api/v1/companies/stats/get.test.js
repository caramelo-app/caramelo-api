const userModel = require("models/user.model");
const cardModel = require("models/card.model");
const creditModel = require("models/credit.model");
const dbHandler = require("utils/db-handler.utils");
const companyModel = require("models/company.model");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const companyHandler = dbHandler(companyModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/stats`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/companies/stats", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint, {
        method: "GET",
      });

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.name).toBe("UnauthorizedError");
      expect(body.message).toBe(localize("error.generic.notFound", { resource: "Token" }));
      expect(body.action).toBe(localize("error.UnauthorizedError.tokenNotFound"));
    });
  });

  describe("Authenticated user", () => {
    describe("User has an incorrect role", () => {
      test("Should return 403 status when the user is a consumer", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            role: roleConstants.USER_ROLES.CONSUMER,
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

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.name).toBe("ForbiddenError");
        expect(body.message).toBe(localize("error.ForbiddenError.message"));
        expect(body.action).toBe(localize("error.ForbiddenError.action"));
      });
    });

    describe("User has a client role", () => {
      test("Should return 200 status with empty stats for new company", async () => {
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

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();

        const token = loginBody.accessToken;

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(typeof body).toBe("object");
        expect(Array.isArray(body.recentClients)).toBe(true);
        expect(body.recentClients.length).toBe(0);
        expect(typeof body.newClientsChart).toBe("object");
        expect(body.newClientsChart.dataKey).toBe("week");
        expect(Array.isArray(body.newClientsChart.data)).toBe(true);
        expect(body.newClientsChart.data.length).toBe(4); // 4 weeks
        expect(body.newClientsChart.total).toBe(0);
        expect(typeof body.creditsGivenChart).toBe("object");
        expect(body.creditsGivenChart.dataKey).toBe("week");
        expect(Array.isArray(body.creditsGivenChart.data)).toBe(true);
        expect(body.creditsGivenChart.data.length).toBe(4); // 4 weeks
        expect(body.creditsGivenChart.total).toBe(0);
        expect(typeof body.creditsUsedChart).toBe("object");
        expect(body.creditsUsedChart.dataKey).toBe("week");
        expect(Array.isArray(body.creditsUsedChart.data)).toBe(true);
        expect(body.creditsUsedChart.data.length).toBe(4); // 4 weeks
        expect(body.creditsUsedChart.total).toBe(0);
      });

      test("Should return 200 status with populated stats for company with data", async () => {
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

        // Create consumers
        const consumers = await orchestrator.createDocumentOnMongo(3, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
          },
        ]);

        // Create card
        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        // Create credits for different consumers
        await orchestrator.createDocumentOnMongo(5, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: false,
            created_at: new Date(), // Recent credit
          },
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: false,
            created_at: new Date(), // Recent credit
          },
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[2]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: false,
            created_at: new Date(), // Recent credit
          },
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.USED, // Used credit
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: false,
            created_at: new Date(),
            updated_at: new Date(), // Recently used
            requested_at: new Date(), // Recently requested/used
          },
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.USED, // Used credit
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: false,
            created_at: new Date(),
            updated_at: new Date(), // Recently used
            requested_at: new Date(), // Recently requested/used
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

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(typeof body).toBe("object");

        // Check recent clients
        expect(Array.isArray(body.recentClients)).toBe(true);
        expect(body.recentClients.length).toBeGreaterThan(0);
        expect(body.recentClients.length).toBeLessThanOrEqual(5);

        // Validate client structure
        expect(body.recentClients.length).toBeGreaterThan(0);
        const client = body.recentClients[0];
        expect(typeof client._id).toBe("string");
        expect(typeof client.name).toBe("string");
        expect(typeof client.phone).toBe("string");
        expect(typeof client.created_at).toBe("string");

        // Check newClientsChart
        expect(typeof body.newClientsChart).toBe("object");
        expect(body.newClientsChart.dataKey).toBe("week");
        expect(Array.isArray(body.newClientsChart.data)).toBe(true);
        expect(body.newClientsChart.data.length).toBe(4);
        expect(typeof body.newClientsChart.total).toBe("number");
        expect(body.newClientsChart.total).toBeGreaterThan(0);

        // Validate week data structure
        body.newClientsChart.data.forEach(week => {
          expect(typeof week.week).toBe("string");
          expect(typeof week.count).toBe("number");
          expect(week.count).toBeGreaterThanOrEqual(0);
        });

        // Check creditsGivenChart
        expect(typeof body.creditsGivenChart).toBe("object");
        expect(body.creditsGivenChart.dataKey).toBe("week");
        expect(Array.isArray(body.creditsGivenChart.data)).toBe(true);
        expect(body.creditsGivenChart.data.length).toBe(4);
        expect(typeof body.creditsGivenChart.total).toBe("number");
        expect(body.creditsGivenChart.total).toBeGreaterThan(0);

        // Check creditsUsedChart
        expect(typeof body.creditsUsedChart).toBe("object");
        expect(body.creditsUsedChart.dataKey).toBe("week");
        expect(Array.isArray(body.creditsUsedChart.data)).toBe(true);
        expect(body.creditsUsedChart.data.length).toBe(4);
        expect(typeof body.creditsUsedChart.total).toBe("number");
        expect(body.creditsUsedChart.total).toBeGreaterThan(0);
      });

      test("Should return 401 status when accessing with valid token but company becomes excluded", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: false, // Company available initially
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
        ]);

        // Login while company is available
        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();
        const token = loginBody.accessToken;

        // Now exclude the company
        await companyHandler.update({
          filter: { _id: company.documentsCreatedOnMongo[0]._id },
          data: { excluded: true },
        });

        // Try to access endpoint with valid token but excluded company
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.notAvailable", { resource: localize("resources.company") }));
      });
    });
  });
}); 