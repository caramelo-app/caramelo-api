require("dotenv").config();
const i18n = require("i18n");
const path = require("path");
const retry = require("async-retry");

const database = require("infra/database");
const createDummyUser = require("tests/mock/user.mock");
const createDummyCard = require("tests/mock/card.mock");
const createDummyCredit = require("tests/mock/credit.mock");
const createDummySegment = require("tests/mock/segment.mock");
const createDummyCompany = require("tests/mock/company.mock");
const createDummyKnownLocation = require("tests/mock/knownlocation.mock");

async function waitForAllServices() {
  await waitForWebServer();
}

async function waitForWebServer() {
  return retry(fetchStatusPage, {
    retries: 100,
    minTimeout: 100,
    maxTimeout: 1000,
  });
}

async function fetchStatusPage() {
  const response = await fetch(`${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/health`);

  if (response.status !== 200) {
    throw new Error();
  }
  return;
}

async function clearDatabase() {
  require("models/knownlocation.model");
  require("models/user.model");
  require("models/company.model");
  require("models/segment.model");
  require("models/card.model");
  require("models/credit.model");
  await database.clearDatabase();
}

async function startLocalization() {
  i18n.configure({
    locales: ["pt_BR"],
    directory: path.join(__dirname, "..", "locales"),
    defaultLocale: "pt_BR",
    objectNotation: true,
  });

  return i18n;
}

async function createDocumentOnMongo(quantity = 1, handler, options = [{}]) {
  const documents = [];
  const documentsCreatedOnMongo = [];

  switch (handler.getModelName()) {
    case "User": {
      for (let i = 0; i < quantity; i++) {
        documents.push(await createDummyUser(options[i]));
      }
      break;
    }
    case "Company": {
      for (let i = 0; i < quantity; i++) {
        documents.push(createDummyCompany(options[i]));
      }
      break;
    }
    case "Segment": {
      for (let i = 0; i < quantity; i++) {
        documents.push(createDummySegment(options[i]));
      }
      break;
    }
    case "Card": {
      for (let i = 0; i < quantity; i++) {
        documents.push(createDummyCard(options[i]));
      }
      break;
    }
    case "Credit": {
      for (let i = 0; i < quantity; i++) {
        documents.push(createDummyCredit(options[i]));
      }
      break;
    }
    case "KnownLocation": {
      for (let i = 0; i < quantity; i++) {
        documents.push(createDummyKnownLocation(options[i]));
      }
      break;
    }
  }

  for (let i = 0; i < quantity; i++) {
    const createdDocument = await handler.create({
      data: documents[i],
    });

    documentsCreatedOnMongo.push(createdDocument);
  }

  return {
    documentsCreated: documents,
    documentsCreatedOnMongo: documentsCreatedOnMongo,
  };
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  startLocalization,
  createDocumentOnMongo,
};

module.exports = orchestrator;
