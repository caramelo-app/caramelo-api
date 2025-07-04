const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const segmentModel = require("models/segment.model");
const companyModel = require("models/company.model");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { fakerPT_BR: faker } = require("@faker-js/faker");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const segmentHandler = dbHandler(segmentModel);
const companyHandler = dbHandler(companyModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/companies/explore`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("GET /api/v1/companies/explore", () => {
  describe("Anonymous user", () => {
    test("Should return 401 status when the user is not sending a token", async () => {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
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
      test("Should return 200 status when the user is a consumer and send the latitude and longitude", async () => {
        const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
          {
            role: roleConstants.USER_ROLES.CONSUMER,
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        const segments = await orchestrator.createDocumentOnMongo(1, segmentHandler, [
          {
            status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          },
        ]);

        await orchestrator.createDocumentOnMongo(2, companyHandler, [
          {
            name: "Rancho Appaloosa",
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
            address: {
              street: faker.location.streetAddress(),
              number: faker.location.buildingNumber(),
              complement: faker.location.secondaryAddress(),
              neighborhood: faker.person.firstName(),
              city: faker.location.city(),
              state: faker.location.state(),
              location: {
                type: "Point",
                coordinates: [-49.24030887067606, -25.35738275006892],
              },
              zipcode: faker.location.zipCode().replace("-", ""),
            },
          },
          {
            name: "Gordo e Magro Gastrobar",
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
            address: {
              street: faker.location.streetAddress(),
              number: faker.location.buildingNumber(),
              complement: faker.location.secondaryAddress(),
              neighborhood: faker.person.firstName(),
              city: faker.location.city(),
              state: faker.location.state(),
              zipcode: faker.location.zipCode().replace("-", ""),
              location: {
                type: "Point",
                coordinates: [-49.24010361515069, -25.365798260045256],
              },
            },
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
        const endpointWithParams = `${endpoint}?latitude=-25.35645387035129&longitude=-49.237713320416866&distance=2&limit=10&skip=0`;

        const response = await fetch(endpointWithParams, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.length).toBe(2);
        expect(Array.isArray(body)).toBe(true);
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
    });
  });
});
