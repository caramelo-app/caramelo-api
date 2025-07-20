const mongoose = require("mongoose");

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

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/consumers/:consumer_id`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("DELETE /api/v1/companies/consumers/:consumer_id", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint, {
        method: "DELETE",
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
          method: "DELETE",
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
      test("Should return 200 status after deleting a consumer", async () => {
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
          },
        ]);

        // Create credits to establish the relationship between consumer and company
        await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumer.documentsCreatedOnMongo[0]._id,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toBe(localize("companies.consumers.delete.success"));

        // Verify the consumer is marked as unavailable and excluded
        const updatedConsumer = await userHandler.read({
          filter: {
            _id: consumer.documentsCreatedOnMongo[0]._id,
          },
        });

        expect(updatedConsumer.status).toBe(statusConsts.RESOURCE_STATUS.UNAVAILABLE);
        expect(updatedConsumer.excluded).toBe(true);
      });

      test("Should return 403 status when trying to delete a consumer that doesn't belong to the company", async () => {
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

        // Note: No credits created, so no relationship between consumer and company

        const loginResponse = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: user.documentsCreated[0].phone, password: user.documentsCreated[0].password }),
        });

        const loginBody = await loginResponse.json();

        const token = loginBody.accessToken;

        const endpointWithConsumerId = endpoint.replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.name).toBe("ForbiddenError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.consumer") }));
      });

      test("Should return 403 status when the consumer does not exist", async () => {
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

        const fakeConsumerId = new mongoose.Types.ObjectId();
        const endpointWithConsumerId = endpoint.replace(":consumer_id", fakeConsumerId);

        const response = await fetch(endpointWithConsumerId, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.name).toBe("ForbiddenError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.consumer") }));
      });

      test("Should return 403 status when the consumer is already excluded", async () => {
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
            excluded: true,
          },
        ]);

        const card = await orchestrator.createDocumentOnMongo(1, cardHandler, [
          {
            company_id: company.documentsCreatedOnMongo[0]._id,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumer.documentsCreatedOnMongo[0]._id,
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

        const endpointWithConsumerId = endpoint.replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithConsumerId, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.name).toBe("ForbiddenError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.consumer") }));
      });
    });
  });
});
