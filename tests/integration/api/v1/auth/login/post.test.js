const jwt = require("jsonwebtoken");

const userModel = require("models/user.model");
const companyModel = require("models/company.model");
const dbHandler = require("utils/db-handler.utils");
const orchestrator = require("tests/orchestrator.js");
const statusConsts = require("constants/status.constants");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);
const companyHandler = dbHandler(companyModel);

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

describe("POST /api/v1/auth/login", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status when the user is authenticated correctly", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreated[0].phone,
          password: user.documentsCreated[0].password,
        }),
      });

      const body = await response.json();

      const decoded = jwt.verify(body.accessToken, process.env.JWT_SECRET);
      expect(decoded._id).toBe(user.documentsCreatedOnMongo[0]._id.toString());
      expect(decoded.role).toBe(user.documentsCreatedOnMongo[0].role);

      await expect(response.status).toBe(200);
      await expect(body.tokenType).toBe("Bearer");
      await expect(body.accessToken).toBeDefined();
      await expect(body.expiresIn).toBe(parseInt(process.env.LOGIN_EXPIRES_IN));
      await expect(body.user.name).toBe(user.documentsCreatedOnMongo[0].name);
      await expect(body.user.role).toBe(user.documentsCreatedOnMongo[0].role);
      await expect(body.user.phone).toBe(user.documentsCreatedOnMongo[0].phone);
      await expect(body.company).toBeUndefined();
    });

    test("Should return 200 status and company data when the user is a client", async () => {
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

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreated[0].phone,
          password: user.documentsCreated[0].password,
        }),
      });

      const body = await response.json();

      const decoded = jwt.verify(body.accessToken, process.env.JWT_SECRET);
      expect(decoded._id).toBe(user.documentsCreatedOnMongo[0]._id.toString());
      expect(decoded.role).toBe(user.documentsCreatedOnMongo[0].role);
      expect(decoded.company_id).toBe(company.documentsCreatedOnMongo[0]._id.toString());

      await expect(response.status).toBe(200);
      await expect(body.tokenType).toBe("Bearer");
      await expect(body.accessToken).toBeDefined();
      await expect(body.expiresIn).toBe(parseInt(process.env.LOGIN_EXPIRES_IN));

      // Verificar dados do usuário
      await expect(body.user.name).toBe(user.documentsCreatedOnMongo[0].name);
      await expect(body.user.role).toBe(user.documentsCreatedOnMongo[0].role);
      await expect(body.user.phone).toBe(user.documentsCreatedOnMongo[0].phone);

      // Verificar dados da empresa
      await expect(body.company).toBeDefined();
      await expect(body.company.name).toBe(company.documentsCreatedOnMongo[0].name);
      await expect(body.company.phone).toBe(company.documentsCreatedOnMongo[0].phone);
      await expect(body.company.address).toEqual(company.documentsCreatedOnMongo[0].address);
      await expect(body.company.logo).toBe(company.documentsCreatedOnMongo[0].logo);
      await expect(body.company.segment._id).toBe(company.documentsCreatedOnMongo[0].segment._id.toString());
      await expect(body.company.segment.name).toBe(company.documentsCreatedOnMongo[0].segment.name);
      await expect(body.company.segment.description).toBe(company.documentsCreatedOnMongo[0].segment.description);
      await expect(body.company.segment.icon).toBe(company.documentsCreatedOnMongo[0].segment.icon);
      await expect(body.company.document).toBe(company.documentsCreatedOnMongo[0].document);
    });

    test("Should return 401 status when the user is not available", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
        },
      ]);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreated[0].phone,
          password: user.documentsCreated[0].password,
        }),
      });

      const body = await response.json();

      const user2 = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.PENDING,
        },
      ]);
      const endpoint2 = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/auth/login`;
      const response2 = await fetch(endpoint2, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user2.documentsCreated[0].phone,
          password: user2.documentsCreated[0].password,
        }),
      });

      const body2 = await response2.json();

      await expect(response.status).toBe(401);
      await expect(body.name).toBe("UnauthorizedError");
      await expect(response2.status).toBe(401);
      await expect(body2.name).toBe("UnauthorizedError");
    });

    test("Should return 401 status when the user is not found", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "5599999999999",
          password: "password",
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(401);
      await expect(body.name).toBe("UnauthorizedError");
      await expect(body.message).toBe(localize("error.generic.notFound", { resource: localize("resources.user") }));
    });

    test("Should return 401 status when the password is invalid", async () => {
      const user = await orchestrator.createDocumentOnMongo(1, userHandler, [
        {
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        },
      ]);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.documentsCreatedOnMongo[0].phone,
          password: "password",
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(401);
      await expect(body.name).toBe("UnauthorizedError");
      await expect(body.message).toBe(localize("error.generic.invalid", { field: "password" }));
    });

    test("Should return 400 status when the phone is not provided", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: "password",
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(400);
      await expect(body.name).toBe("ValidationError");
      await expect(body.message).toBe(localize("error.generic.required", { field: "phone" }));
    });

    test("Should return 400 status when the password is not provided", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "5599999999999",
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(400);
      await expect(body.name).toBe("ValidationError");
      await expect(body.message).toBe(localize("error.generic.required", { field: "password" }));
    });

    test("Should return 400 status when the phone is invalid", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "test",
          password: "password",
        }),
      });

      const body = await response.json();

      await expect(response.status).toBe(400);
      await expect(body.name).toBe("ValidationError");
      await expect(body.message).toBe(localize("error.generic.invalidFormat", { field: "phone" }));
    });
  });
});
