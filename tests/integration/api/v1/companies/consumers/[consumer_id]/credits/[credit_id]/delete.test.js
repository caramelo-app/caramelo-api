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

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/consumers/:consumer_id/credits/:credit_id`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("DELETE /api/v1/companies/consumers/:consumer_id/credits/:credit_id", () => {
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
      test("Should return 200 status after deleting a consumer credit", async () => {
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

        // Create a credit to be deleted
        const credit = await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumer.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
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

        const endpointWithIds = endpoint
          .replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id)
          .replace(":credit_id", credit.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithIds, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toBe(localize("companies.consumers.deleteCredit.success"));

        // Verify the credit is marked as excluded but status is preserved
        const updatedCredit = await creditHandler.read({
          filter: {
            _id: credit.documentsCreatedOnMongo[0]._id,
          },
        });

        expect(updatedCredit.excluded).toBe(true);
        expect(updatedCredit.status).toBe(statusConsts.CREDITS_STATUS.AVAILABLE); // Status preserved
      });

      test("Should return 403 status when trying to delete a credit that doesn't belong to the consumer", async () => {
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

        const consumers = await orchestrator.createDocumentOnMongo(2, userHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            role: roleConstants.USER_ROLES.CONSUMER,
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

        // Create credit for first consumer
        const credit = await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumers.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
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

        // Try to delete credit using second consumer's ID (but credit belongs to first consumer)
        const endpointWithIds = endpoint
          .replace(":consumer_id", consumers.documentsCreatedOnMongo[1]._id)
          .replace(":credit_id", credit.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithIds, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.name).toBe("NotFoundError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.credit") }));
      });

      test("Should return 404 status when the credit does not exist", async () => {
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

        // Create credit to establish relationship between consumer and company
        await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumer.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
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

        const fakeCreditId = new mongoose.Types.ObjectId();
        const endpointWithIds = endpoint
          .replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id)
          .replace(":credit_id", fakeCreditId);

        const response = await fetch(endpointWithIds, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.name).toBe("NotFoundError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.credit") }));
      });

      test("Should return 404 status when trying to delete an already excluded credit", async () => {
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

        // Create excluded credit
        const credit = await orchestrator.createDocumentOnMongo(1, creditHandler, [
          {
            card_id: card.documentsCreatedOnMongo[0]._id,
            user_id: consumer.documentsCreatedOnMongo[0]._id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id: company.documentsCreatedOnMongo[0]._id,
            excluded: true, // Already excluded
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

        const endpointWithIds = endpoint
          .replace(":consumer_id", consumer.documentsCreatedOnMongo[0]._id)
          .replace(":credit_id", credit.documentsCreatedOnMongo[0]._id);

        const response = await fetch(endpointWithIds, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.name).toBe("NotFoundError");
        expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.credit") }));
      });
    });
  });
});
