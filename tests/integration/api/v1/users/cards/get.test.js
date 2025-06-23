const userModel = require("models/user.model");
const cardModel = require("models/card.model");
const creditModel = require("models/credit.model");
const dbHandler = require("utils/db-handler.utils");
const companyModel = require("models/company.model");
const segmentModel = require("models/segment.model");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const companyHandler = dbHandler(companyModel);
const segmentHandler = dbHandler(segmentModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/users/cards`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/users/cards", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint);

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.name).toBe("UnauthorizedError");
      expect(body.message).toBe(localize("error.generic.notFound", { resource: "Token" }));
      expect(body.action).toBe(localize("error.UnauthorizedError.tokenNotFound"));
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
      test("Should return 200 status when the user is authenticated returning the user's cards", async () => {
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

        const companies = await orchestrator.createDocumentOnMongo(2, companyHandler, [
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
        let credits = [];

        for (let i = 0; i < companies.documentsCreatedOnMongo.length; i++) {
          const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
            {
              status: statusConsts.RESOURCE_STATUS.AVAILABLE,
              company_id: companies.documentsCreatedOnMongo[i]._id,
            },
          ]);
          cards.push(card);
          const credit = await orchestrator.createDocumentOnMongo(1, creditHandler, [
            {
              status: statusConsts.CREDITS_STATUS.AVAILABLE,
              card_id: card.documentsCreatedOnMongo[0]._id,
              user_id: user.documentsCreatedOnMongo[0]._id,
              company_id: companies.documentsCreatedOnMongo[i]._id,
            },
          ]);
          credits.push(credit);
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

        const response = await fetch(endpoint, {
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
        expect(body[0]).toHaveProperty("company");
        expect(body[0].company).toHaveProperty("name");
        expect(body[0].company).toHaveProperty("segment");
        expect(body[0].company).toHaveProperty("logo");
        expect(body[0].company).toHaveProperty("address");

        // Verify second object structure
        expect(body[1]).toHaveProperty("company");
        expect(body[1].company).toHaveProperty("name");
        expect(body[1].company).toHaveProperty("segment");
        expect(body[1].company).toHaveProperty("logo");
        expect(body[1].company).toHaveProperty("address");

        // To check values after company/card/credits creation
        expect(body[0]).toEqual(
          expect.objectContaining({
            company: expect.objectContaining({
              name: companies.documentsCreatedOnMongo[0].name,
              segment: expect.objectContaining({
                name: segments.documentsCreatedOnMongo[0].name,
              }),
              logo: companies.documentsCreatedOnMongo[0].logo,
              address: expect.objectContaining({
                street: companies.documentsCreatedOnMongo[0].address.street,
                number: companies.documentsCreatedOnMongo[0].address.number,
                complement: companies.documentsCreatedOnMongo[0].address.complement,
                neighborhood: companies.documentsCreatedOnMongo[0].address.neighborhood,
                city: companies.documentsCreatedOnMongo[0].address.city,
                state: companies.documentsCreatedOnMongo[0].address.state,
              }),
            }),
          }),
        );

        expect(body[1]).toEqual(
          expect.objectContaining({
            company: expect.objectContaining({
              name: companies.documentsCreatedOnMongo[1].name,
              segment: expect.objectContaining({
                name: segments.documentsCreatedOnMongo[0].name,
              }),
              logo: companies.documentsCreatedOnMongo[1].logo,
              address: expect.objectContaining({
                street: companies.documentsCreatedOnMongo[1].address.street,
                number: companies.documentsCreatedOnMongo[1].address.number,
                complement: companies.documentsCreatedOnMongo[1].address.complement,
                neighborhood: companies.documentsCreatedOnMongo[1].address.neighborhood,
                city: companies.documentsCreatedOnMongo[1].address.city,
                state: companies.documentsCreatedOnMongo[1].address.state,
              }),
            }),
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
            status: statusConsts.RESOURCE_STATUS.EXCLUDED,
          },
        ]);

        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
        ]);

        await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: user.documentsCreatedOnMongo[0]._id,
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

        expect(response.status).toBe(200);
        expect(body).toHaveLength(0);
        expect(Array.isArray(body)).toBe(true);
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

        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
        ]);

        await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: user.documentsCreatedOnMongo[0]._id,
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

        expect(response.status).toBe(200);
        expect(body).toHaveLength(0);
        expect(Array.isArray(body)).toBe(true);
      });
    });
  });
});
