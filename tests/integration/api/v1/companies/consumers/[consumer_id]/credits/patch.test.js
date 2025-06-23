const userModel = require("models/user.model");
const cardModel = require("models/card.model");
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

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/consumers/:consumer_id/credits`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("PATCH /api/v1/companies/consumers/:consumer_id/credits", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint, {
        method: "PATCH",
      });

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.name).toBe("UnauthorizedError");
      expect(body.message).toBe(localize("error.generic.notFound", { resource: "Token" }));
      expect(body.action).toBe(localize("error.UnauthorizedError.tokenNotFound"));
    });
  });

  describe("Authenticated user", () => {
    describe("User has a incorrect role", () => {
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
          method: "PATCH",
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
      test("Should return 200 status after update consumer credits", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toBe(localize("companies.consumers.updateCredits.success"));
      });

      test("Should return 400 status when the user is not sending credits array", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.required", { field: "credits" }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });

      test("Should return 400 status when the user is not sending credits with card_id", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
          },
        ]);

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();
        const token = loginBody.accessToken;

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.required", { field: "credits.card_id" }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });

      test("Should return 400 status when the user is not sending credits with quantity", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
          },
        ]);

        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();
        const token = loginBody.accessToken;

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.required", { field: "credits.quantity" }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });

      test("Should return 403 status when the user is not sending a valid client card_id", async () => {
        const company = await orchestrator.createDocumentOnMongo(2, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[1]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.name).toBe("ForbiddenError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.card") }));
        expect(body.action).toBe(localize("companies.consumers.updateCredits.error.action"));
      });

      test("Should return 401 status when the user is excluded", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
            excluded: true,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.notAvailable", { resource: localize("resources.user") }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });

      test("Should return 401 status when the user is not available", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.notAvailable", { resource: localize("resources.user") }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });

      test("Should return 401 status when the company is not available", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });

      test("Should return 401 when the company is excluded", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: true,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            role: roleConstants.USER_ROLES.CLIENT,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", user.documentsCreatedOnMongo[1]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });
    });
  });
});
