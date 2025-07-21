const mongoose = require("mongoose");
const { fakerPT_BR: faker } = require("@faker-js/faker");

const userModel = require("models/user.model");
const dbHandler = require("utils/db-handler.utils");
const passwordUtils = require("utils/password.utils");
const orchestrator = require("tests/orchestrator.js");
const roleConstants = require("constants/roles.constants");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

// Handlers
const userHandler = dbHandler(userModel);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

describe("DB Handler Utils", () => {
  describe("List", () => {
    test("Should return a list of documents", async () => {
      await orchestrator.createDocumentOnMongo(5, userHandler);
      const response = await userHandler.list();
      expect(response.length).toBe(5);
    });

    test("Should return a list of documents limited by the limit parameter", async () => {
      await orchestrator.createDocumentOnMongo(3, userHandler);
      const response = await userHandler.list({ limit: 2 });
      expect(response.length).toBe(2);
    });

    test("Should return a list of documents sorted by the sort parameter", async () => {
      const { documentsCreatedOnMongo } = await orchestrator.createDocumentOnMongo(2, userHandler, [
        {
          name: "Ctest",
        },
        {
          name: "Atest",
        },
      ]);
      const response = await userHandler.list({ sort: { name: 1 } });
      expect(response.length).toBe(2);
      expect(response[0].name).toBe(documentsCreatedOnMongo[1].name);
      expect(response[1].name).toBe(documentsCreatedOnMongo[0].name);
    });

    test("Should return a list of documents with projected fields", async () => {
      await orchestrator.createDocumentOnMongo(5, userHandler);
      const response = await userHandler.list({
        projection: { name: 1 },
      });
      expect(response.length).toBe(5);
      expect(response[0].name).toBeDefined();
    });

    test("Should return a list of documents filtered by the filter parameter", async () => {
      await orchestrator.createDocumentOnMongo(3, userHandler, [
        {
          name: "Atest",
        },
        {
          name: "Btest",
        },
        {
          name: "Ctest",
        },
      ]);
      const response = await userHandler.list({ filter: { name: "Atest" } });
      expect(response.length).toBe(1);
    });

    test("Should return a list of documents skipped by the skip parameter", async () => {
      await orchestrator.createDocumentOnMongo(3, userHandler, [
        {
          name: "Atest",
        },
        {
          name: "Btest",
        },
        {
          name: "Ctest",
        },
      ]);
      const response = await userHandler.list({ skip: 1 });
      expect(response.length).toBe(2);
      expect(response[0].name).toBe("Btest");
      expect(response[1].name).toBe("Ctest");
    });

    test("Should return an empty list if no records found", async () => {
      const response = await userHandler.list({ filter: { name: "Atest" } });
      expect(response.length).toBe(0);
    });
  });

  describe("Read", () => {
    test("Should return the document found", async () => {
      const createdDocument = await orchestrator.createDocumentOnMongo(1, userHandler);
      const response = await userHandler.read({ filter: { _id: createdDocument.documentsCreatedOnMongo[0]._id } });
      expect(response.name).toBe(createdDocument.documentsCreatedOnMongo[0].name);
    });

    test("Should return the document with projection", async () => {
      const createdDocument = await orchestrator.createDocumentOnMongo(1, userHandler);
      const response = await userHandler.read({
        filter: { _id: createdDocument.documentsCreatedOnMongo[0]._id },
        projection: { name: 1 },
      });
      expect(response.name).toBe(createdDocument.documentsCreatedOnMongo[0].name);
    });

    test("Should return null if the document is not found", async () => {
      const response = await userHandler.read({ filter: { _id: new mongoose.Types.ObjectId() } });
      expect(response).toBeNull();
    });

    test("Should return InternalServerError if the filter is not provided", async () => {
      const response = await userHandler.read();
      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(localize("error.generic.notFound", { resource: "options.filter" }));
    });
  });

  describe("Create", () => {
    test("Should return the document created", async () => {
      const response = await orchestrator.createDocumentOnMongo(1, userHandler);

      expect(response.documentsCreated[0].name).toBe(response.documentsCreatedOnMongo[0].name);
      expect(response.documentsCreated[0].role).toBe(response.documentsCreatedOnMongo[0].role);
      expect(response.documentsCreated[0].phone).toBe(response.documentsCreatedOnMongo[0].phone);

      const correctPasswordMatch = await passwordUtils.compare(
        response.documentsCreated[0].password,
        response.documentsCreatedOnMongo[0].password,
      );
      const incorrectPasswordMatch = await passwordUtils.compare(
        "test123@!1",
        response.documentsCreatedOnMongo[0].password,
      );

      expect(correctPasswordMatch).toBe(true);
      expect(incorrectPasswordMatch).toBe(false);
    });

    test("Should return ValidationError if the document is not valid", async () => {
      const response = await userHandler.create({
        data: { name: faker.person.fullName() },
      });
      expect(response.name).toBe("ValidationError");
      expect(response.message).toBe(localize("error.dbHandler.create.message"));
    });

    test("Should return InternalServerError if we try to create a document with a duplicate unique field", async () => {
      const createdDocument = await orchestrator.createDocumentOnMongo(1, userHandler);

      const response = await userHandler.create({
        data: createdDocument.documentsCreated[0],
      });

      expect(response.name).toBe("InternalServerError");
      expect(response.cause.code).toBe(11000);
    });
  });

  describe("Update", () => {
    test("Should return the document updated", async () => {
      const createdDocument = await orchestrator.createDocumentOnMongo(1, userHandler);
      const updatedDocument = await userHandler.update({
        filter: { _id: createdDocument.documentsCreatedOnMongo[0]._id },
        data: {
          role: roleConstants.USER_ROLES.ADMIN,
        },
      });

      expect(updatedDocument.role).toBe(roleConstants.USER_ROLES.ADMIN);
      expect(updatedDocument.name).toBe(createdDocument.documentsCreatedOnMongo[0].name);
      expect(updatedDocument.password).toBe(createdDocument.documentsCreatedOnMongo[0].password);
      expect(updatedDocument.phone).toBe(createdDocument.documentsCreatedOnMongo[0].phone);
      expect(updatedDocument.updated_at > updatedDocument.created_at).toBe(true);
    });

    test("Should return no changes if the document is not found", async () => {
      const response = await userHandler.update({
        filter: { _id: new mongoose.Types.ObjectId() },
        data: { name: faker.person.fullName() },
      });

      expect(response).toBeNull();
    });

    test("Should return InternalServerError if the filter is not provided", async () => {
      const response = await userHandler.update({
        data: { name: faker.person.fullName() },
      });

      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(
        localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      );
    });
  });

  describe("Remove", () => {
    test("Should remove the document specified by the filter", async () => {
      const createdDocument = await orchestrator.createDocumentOnMongo(1, userHandler);

      const removedDocument = await userHandler.remove({
        filter: { _id: createdDocument.documentsCreatedOnMongo[0]._id },
      });

      expect(removedDocument.acknowledged).toBe(true);
      expect(removedDocument.deletedCount).toBe(1);
    });

    test("Should return deletedCount 0 if the document is not found", async () => {
      const response = await userHandler.remove({
        filter: { _id: new mongoose.Types.ObjectId() },
      });

      expect(response.deletedCount).toBe(0);
    });

    test("Should return InternalServerError if the filter is not provided", async () => {
      const response = await userHandler.remove({});

      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(
        localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      );
    });
  });

  describe("Aggregate", () => {
    test("Should return the aggregated documents", async () => {
      await orchestrator.createDocumentOnMongo(2, userHandler, [
        {
          name: "Atest",
        },
        {
          name: "Btest",
        },
      ]);
      const response = await userHandler.aggregate({
        pipeline: [{ $match: { name: "Atest" } }],
      });
      expect(response.length).toBe(1);
    });

    test("Should return ServiceError if the pipeline is not provided", async () => {
      const response = await userHandler.aggregate();
      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(localize("error.dbHandler.aggregate.message"));
    });

    test("Should return InternalServerError if the pipeline is invalid (MongoDB Error)", async () => {
      const response = await userHandler.aggregate({
        pipeline: [{ $invalidMethod: true }],
      });

      expect(response.name).toBe("InternalServerError");
    });
  });

  describe("UpdateMany", () => {
    test("Should update multiple documents successfully", async () => {
      // Create 3 documents
      const { documentsCreatedOnMongo } = await orchestrator.createDocumentOnMongo(3, userHandler, [
        { name: "User1", role: roleConstants.USER_ROLES.CONSUMER },
        { name: "User2", role: roleConstants.USER_ROLES.CONSUMER },
        { name: "User3", role: roleConstants.USER_ROLES.CLIENT },
      ]);

      // Update all consumers to admin role
      const updateResult = await userHandler.updateMany({
        filter: { role: roleConstants.USER_ROLES.CONSUMER },
        data: { role: roleConstants.USER_ROLES.ADMIN },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(2);
      expect(updateResult.matchedCount).toBe(2);

      // Verify the updates
      const updatedUsers = await userHandler.list({
        filter: { _id: { $in: documentsCreatedOnMongo.map((doc) => doc._id) } },
      });

      const adminUsers = updatedUsers.filter((user) => user.role === roleConstants.USER_ROLES.ADMIN);
      const clientUsers = updatedUsers.filter((user) => user.role === roleConstants.USER_ROLES.CLIENT);

      expect(adminUsers.length).toBe(2);
      expect(clientUsers.length).toBe(1);
    });

    test("Should return 0 modifiedCount when no documents match the filter", async () => {
      const updateResult = await userHandler.updateMany({
        filter: { name: "NonExistentUser" },
        data: { role: roleConstants.USER_ROLES.ADMIN },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(0);
      expect(updateResult.matchedCount).toBe(0);
    });

    test("Should handle complex filters and updates", async () => {
      // Create documents with different statuses
      await orchestrator.createDocumentOnMongo(3, userHandler, [
        { name: "ActiveUser1", status: "available" },
        { name: "ActiveUser2", status: "available" },
        { name: "InactiveUser", status: "pending" },
      ]);

      // Update only available users
      const updateResult = await userHandler.updateMany({
        filter: { status: "available" },
        data: { status: "inactive" },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(2);

      // Verify only available users were updated
      const updatedUsers = await userHandler.list({
        filter: { status: "inactive" },
      });
      expect(updatedUsers.length).toBe(2);

      const pendingUsers = await userHandler.list({
        filter: { status: "pending" },
      });
      expect(pendingUsers.length).toBe(1);
    });

    test("Should handle updates with timestamps", async () => {
      const { documentsCreatedOnMongo } = await orchestrator.createDocumentOnMongo(2, userHandler);

      const updateResult = await userHandler.updateMany({
        filter: { _id: { $in: documentsCreatedOnMongo.map((doc) => doc._id) } },
        data: { name: "UpdatedName" },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(2);

      // Verify the documents were updated
      const updatedUsers = await userHandler.list({
        filter: { _id: { $in: documentsCreatedOnMongo.map((doc) => doc._id) } },
      });

      updatedUsers.forEach((user) => {
        expect(user.name).toBe("UpdatedName");
      });
    });

    test("Should handle updates with options", async () => {
      const { documentsCreatedOnMongo } = await orchestrator.createDocumentOnMongo(2, userHandler);

      const updateResult = await userHandler.updateMany({
        filter: { _id: { $in: documentsCreatedOnMongo.map((doc) => doc._id) } },
        data: { name: "UpdatedWithOptions" },
        options: { upsert: false },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(2);
    });

    test("Should return ServiceError if filter is not provided", async () => {
      const response = await userHandler.updateMany({
        data: { name: "UpdatedName" },
      });

      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(
        localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      );
    });

    test("Should return ServiceError if data is not provided", async () => {
      const response = await userHandler.updateMany({
        filter: { name: "SomeUser" },
      });

      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(
        localize("error.generic.notFound", {
          resource: "options.data",
        }),
      );
    });

    test("Should return ServiceError if both filter and update are not provided", async () => {
      const response = await userHandler.updateMany({});

      expect(response.name).toBe("ServiceError");
      expect(response.message).toBe(
        localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      );
    });
  });

  describe("Get Model Name", () => {
    test("Should return the model name", async () => {
      const response = userHandler.getModelName();
      expect(response).toBe("User");
    });
  });
});
