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

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/credits`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/companies/credits", () => {
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
      test("Should return 200 status with pending credits and their users/cards data", async () => {
        const company = await orchestrator.createDocumentOnMongo(2, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
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

        const card = await orchestrator.createDocumentOnMongo(4, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
          },
          {
            company_id: company.documentsCreatedOnMongo[1]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const credit = await orchestrator.createDocumentOnMongo(5, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: user.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.PENDING,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: user.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.PENDING,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
          {
            card_id: card.documentsCreatedOnMongo[1]._id,
            user_id: user.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
          {
            card_id: card.documentsCreatedOnMongo[2]._id,
            user_id: user.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.PENDING,
            company_id: company.documentsCreatedOnMongo[0]._id,
          },
          {
            card_id: card.documentsCreatedOnMongo[3]._id,
            user_id: user.documentsCreatedOnMongo[1]._id,
            status: statusConsts.CREDITS_STATUS.PENDING,
            company_id: company.documentsCreatedOnMongo[1]._id,
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

        expect(typeof body).toBe("object");
        expect(response.status).toBe(200);
        expect(body.length).toBe(2);

        expect(body[0]._id).toBe(credit.documentsCreatedOnMongo[0]._id.toString());
        expect(body[0].card_id).toBe(card.documentsCreatedOnMongo[0]._id.toString());
        expect(body[0].user_id).toBe(user.documentsCreatedOnMongo[1]._id.toString());
        expect(body[0].card).toBeDefined();
        expect(body[0].card._id).toBe(card.documentsCreatedOnMongo[0]._id.toString());
        expect(body[0].card.title).toBe(card.documentsCreatedOnMongo[0].title);
        expect(body[0].user).toBeDefined();
        expect(body[0].user._id).toBe(user.documentsCreatedOnMongo[1]._id.toString());
        expect(body[0].user.name).toBe(user.documentsCreatedOnMongo[1].name);
        expect(body[0].user.phone).toBe(user.documentsCreatedOnMongo[1].phone);
        expect(body[0].created_at).toBeDefined();
        expect(body[1]._id).toBe(credit.documentsCreatedOnMongo[1]._id.toString());
        expect(body[1].card_id).toBe(card.documentsCreatedOnMongo[0]._id.toString());
        expect(body[1].user_id).toBe(user.documentsCreatedOnMongo[1]._id.toString());
        expect(body[1].card).toBeDefined();
        expect(body[1].card._id).toBe(card.documentsCreatedOnMongo[0]._id.toString());
        expect(body[1].card.title).toBe(card.documentsCreatedOnMongo[0].title);
        expect(body[1].user).toBeDefined();
        expect(body[1].user._id).toBe(user.documentsCreatedOnMongo[1]._id.toString());
        expect(body[1].user.name).toBe(user.documentsCreatedOnMongo[1].name);
        expect(body[1].user.phone).toBe(user.documentsCreatedOnMongo[1].phone);
        expect(body[1].created_at).toBeDefined();
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

      test("Should return 401 status when the company is not available", async () => {
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

      test("Should return 401 when the company is excluded", async () => {
        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            excluded: true,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
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

        expect(response.status).toBe(401);
        expect(body.name).toBe("UnauthorizedError");
        expect(body.message).toBe(localize("error.generic.invalid", { field: "token" }));
        expect(body.action).toBe(localize("error.UnauthorizedError.action"));
      });
    });
  });
});
