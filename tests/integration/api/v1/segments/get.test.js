const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const segmentModel = require("models/segment.model");
const companyModel = require("models/company.model");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const segmentHandler = dbHandler(segmentModel);
const companyHandler = dbHandler(companyModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/segments`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/segments", () => {
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
    describe("Consumer role", () => {
      test("Should return 200 status and list of available segments", async () => {
        await orchestrator.clearDatabase();
        await orchestrator.createDocumentOnMongo(4, segmentHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: false,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: false,
          },
          {
            status: statusConsts.RESOURCE_STATUS.UNAVAILABLE, // Deve ser filtrado
            excluded: false,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: true, // Deve ser filtrado
          },
        ]);

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

        expect(response.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBe(2); // Apenas segments available

        body.forEach((segment) => {
          expect(segment).toHaveProperty("_id");
          expect(segment).toHaveProperty("name");
          expect(segment).toHaveProperty("icon");
          expect(segment).toHaveProperty("description");
          expect(segment).not.toHaveProperty("status");
          expect(segment).not.toHaveProperty("excluded");
          expect(segment).not.toHaveProperty("created_at");
          expect(segment).not.toHaveProperty("updated_at");
        });
      });
    });

    describe("Client role", () => {
      test("Should return 200 status and list of available segments", async () => {
        await orchestrator.clearDatabase();
        await orchestrator.createDocumentOnMongo(2, segmentHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: false,
          },
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
            excluded: true,
          },
        ]);

        const company = await orchestrator.createDocumentOnMongo(1, companyHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            role: roleConstants.USER_ROLES.CLIENT,
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
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBe(1); // Apenas segments available e não excluded

        body.forEach((segment) => {
          expect(segment).toHaveProperty("_id");
          expect(segment).toHaveProperty("name");
          expect(segment).toHaveProperty("icon");
          expect(segment).toHaveProperty("description");
          expect(segment).not.toHaveProperty("status");
          expect(segment).not.toHaveProperty("excluded");
        });
      });
    });
  });
});
