const dataUtils = require("utils/data.utils");
const userModel = require("models/user.model");
const cardModel = require("models/card.model");
const creditModel = require("models/credit.model");
const dbHandler = require("utils/db-handler.utils");
const companyModel = require("models/company.model");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { fakerPT_BR: faker } = require("@faker-js/faker");
const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const companyHandler = dbHandler(companyModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/consumers`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/companies/consumers", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
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
          method: "POST",
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
      test("Should return 200 status after get the company consumers", async () => {
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

        const card = await orchestrator.createDocumentOnMongo(2, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
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
          body: JSON.stringify({
            phone: user.documentsCreated[0].phone,
            password: user.documentsCreated[0].password,
          }),
        });

        const loginBody = await loginResponse.json();

        const token = loginBody.accessToken;

        const phone = dataUtils.generatePhoneNumber();
        const name = faker.person.fullName();

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            phone,
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
              {
                card_id: card.documentsCreatedOnMongo[1]._id,
                quantity: 2,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toBe(localize("companies.consumers.create.success"));

        const userCheck = await userHandler.read({
          filter: {
            phone,
          },
          projection: {
            name: 1,
            phone: 1,
            role: 1,
            status: 1,
            excluded: 1,
          },
        });

        expect(userCheck).toBeDefined();
        expect(userCheck.name).toBe(name);
        expect(userCheck.phone).toBe(phone);
        expect(userCheck.role).toBe(roleConstants.USER_ROLES.CONSUMER);
        expect(userCheck.status).toBe(statusConsts.RESOURCE_STATUS.AVAILABLE);
        expect(userCheck.excluded).toBe(false);

        const creditCheckOptions = {
          filter: {
            user_id: userCheck._id,
          },
          projection: {
            _id: 1,
            card_id: 1,
            user_id: 1,
            status: 1,
            company_id: 1,
          },
        };

        const creditCheck = await creditHandler.list(creditCheckOptions);

        expect(creditCheck).toBeDefined();
        expect(creditCheck.length).toBe(6);

        // Check first card credits (4 credits)
        const firstCardCredits = creditCheck.filter(
          (credit) => credit.card_id.toString() === card.documentsCreatedOnMongo[0]._id.toString(),
        );
        expect(firstCardCredits.length).toBe(4);
        firstCardCredits.forEach((credit) => {
          expect(credit.user_id.toString()).toBe(userCheck._id.toString());
          expect(credit.status).toBe(statusConsts.RESOURCE_STATUS.AVAILABLE);
          expect(credit.company_id.toString()).toBe(company.documentsCreatedOnMongo[0]._id.toString());
        });

        // Check second card credits (2 credits)
        const secondCardCredits = creditCheck.filter(
          (credit) => credit.card_id.toString() === card.documentsCreatedOnMongo[1]._id.toString(),
        );
        expect(secondCardCredits.length).toBe(2);
        secondCardCredits.forEach((credit) => {
          expect(credit.user_id.toString()).toBe(userCheck._id.toString());
          expect(credit.status).toBe(statusConsts.RESOURCE_STATUS.AVAILABLE);
          expect(credit.company_id.toString()).toBe(company.documentsCreatedOnMongo[0]._id.toString());
        });
      });

      test("Should return 400 status when the user is not sending a phone", async () => {
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

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: faker.person.fullName(),
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.ValidationError.message"));
        expect(body.action).toBe(localize("error.ValidationError.action"));
      });

      test("Should return 400 status when the user are not sending credits with quantity", async () => {
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

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: faker.person.fullName(),
            phone: dataUtils.generatePhoneNumber(),
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

      test("Should return 400 status when the user are not sending credits with card_id", async () => {
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
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: faker.person.fullName(),
            phone: dataUtils.generatePhoneNumber(),
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

      test("Should return 400 when the user is already exists", async () => {
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
            role: roleConstants.USER_ROLES.CONSUMER,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
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

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: user.documentsCreated[1].name,
            phone: user.documentsCreated[1].phone,
            credits: [
              {
                card_id: card.documentsCreatedOnMongo[0]._id,
                quantity: 4,
              },
            ],
          }),
        });

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.name).toBe("ValidationError");
        expect(body.message).toBe(localize("error.generic.alreadyExists", { resource: localize("resources.user") }));
        expect(body.action).toBe(localize("error.ValidationError.action"));
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

        const response = await fetch(endpoint, {
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
    });
  });
});
