const userModel = require("models/user.model");
const cardModel = require("models/card.model");
const orchestrator = require("tests/orchestrator");
const dbHandler = require("utils/db-handler.utils");
const companyModel = require("models/company.model");
const segmentModel = require("models/segment.model");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const companyHandler = dbHandler(companyModel);
const segmentHandler = dbHandler(segmentModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/users/cards/companies/:company_id/list`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/users/cards/companies/:company_id/list", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);

      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          role: roleConstants.USER_ROLES.CLIENT,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          company_id: company.documentsCreatedOnMongo[0]._id,
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

  describe("Authenticated user", () => {
    describe("User has a incorrect role", () => {
      test("Should return 403 status when the user is a client", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            role: roleConstants.USER_ROLES.CLIENT,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
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

    describe("User has a consumer role", () => {
      test("Should return 200 status when the user is authenticated returning the companies cards available", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const segments = await orchestrator.createDocumentOnMongo(1, segmentHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const companies = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            segment: {
              _id: segments.documentsCreatedOnMongo[0]._id,
              name: segments.documentsCreatedOnMongo[0].name,
              icon: segments.documentsCreatedOnMongo[0].icon,
              description: segments.documentsCreatedOnMongo[0].description,
              status: segments.documentsCreatedOnMongo[0].status,
              excluded: segments.documentsCreatedOnMongo[0].excluded,
            },
            excluded: false,
          },
        ]);

        let cards = [];

        for (let i = 0; i < companies.documentsCreatedOnMongo.length; i++) {
          const card = await orchestrator.createDocumentOnMongo(2, cardHandler, [
            {
              status: statusConsts.RESOURCE_STATUS.AVAILABLE,
              company_id: companies.documentsCreatedOnMongo[i]._id,
            },
            {
              status: statusConsts.RESOURCE_STATUS.AVAILABLE,
              company_id: companies.documentsCreatedOnMongo[i]._id,
            },
          ]);
          cards.push(card);
        }

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();

        const token = loginBody.accessToken;

        const endpointWithCompanyId = endpoint.replace(
          ":company_id",
          companies.documentsCreatedOnMongo[0]._id.toString(),
        );

        const response = await fetch(endpointWithCompanyId, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(2);
        expect(Array.isArray(body)).toBe(true);

        // Verify first object structure
        expect(body[0]).toHaveProperty("title");

        // Verify second object structure
        expect(body[1]).toHaveProperty("title");

        // To check values after company/card/credits creation
        expect(body[0]).toEqual(
          expect.objectContaining({
            title: cards[0].documentsCreatedOnMongo[0].title,
          }),
        );

        expect(body[1]).toEqual(
          expect.objectContaining({
            title: cards[0].documentsCreatedOnMongo[1].title,
          }),
        );
      });

      test("Should return 401 status when the user is excluded", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            excluded: true,
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

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });

      test("Should return 401 status when the user is not available", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.PENDING,
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

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });

      test("Should not return cards from a company that is excluded", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: true,
          },
        ]);

        await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
        ]);

        const endpointWithCompanyId = endpoint.replace(
          ":company_id",
          company.documentsCreatedOnMongo[0]._id.toString(),
        );

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();
        const token = loginBody.accessToken;

        const response = await fetch(endpointWithCompanyId, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.notAvailable", { resource: localize("resources.company") }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });

      test("Should not return cards when the company is not available", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.PENDING,
          },
        ]);

        await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
        ]);

        const endpointWithCompanyId = endpoint.replace(
          ":company_id",
          company.documentsCreatedOnMongo[0]._id.toString(),
        );

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();
        const token = loginBody.accessToken;

        const response = await fetch(endpointWithCompanyId, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.notAvailable", { resource: localize("resources.company") }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });
    });
  });
});
