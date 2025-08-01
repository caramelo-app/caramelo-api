const dbHandler = require("../utils/db-handler.utils");

const { fakerPT_BR: faker } = require("@faker-js/faker");
const cliProgress = require("cli-progress");
const { ValidationError } = require("../infra/errors");

// Models
const userModel = require("../models/user.model");
const cardModel = require("../models/card.model");
const creditModel = require("../models/credit.model");
const companyModel = require("../models/company.model");
const segmentModel = require("../models/segment.model");

// Constants
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");
const datesConstants = require("../constants/dates.constants");

// Utils
const dateUtils = require("../utils/date.utils");
const createDummyUser = require("../tests/mock/user.mock");
const createDummyCard = require("../tests/mock/card.mock");
const createDummyCredit = require("../tests/mock/credit.mock");
const createDummyCompany = require("../tests/mock/company.mock");

// Handlers
const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const companyHandler = dbHandler(companyModel);
const segmentHandler = dbHandler(segmentModel);

// Function to fetch random addresses from Google Places API
async function fetchRandomAddresses(count = 20) {
  const response = await fetch(
    `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/utils/places?city=Curitiba&state=PR&count=${count}`,
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch addresses from Google Places API: ${response.status} ${response.statusText}`);
  }

  const addresses = await response.json();

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("No addresses returned from Google Places API");
  }

  return addresses;
}

/**
 * @swagger
 * /v1/loadtest/generate:
 *   post:
 *     summary: Generate load test data
 *     description: Create test data for load testing including companies, users, cards and credits
 *     tags: [LoadTest]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companies:
 *                 type: number
 *                 description: Number of companies to create
 *                 example: 50
 *               consumers:
 *                 type: number
 *                 description: Number of consumers to create
 *                 example: 3000
 *     responses:
 *       200:
 *         description: Test data generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Load test data generated successfully"
 *                 summary:
 *                   type: object
 *                   properties:
 *                     companies:
 *                       type: number
 *                     users:
 *                       type: number
 *                     cards:
 *                       type: number
 *                     credits:
 *                       type: number
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function generateLoadTestData(req, res, next) {
  let progressBar;
  try {
    const { companies = 50, consumers = 3000 } = req.body;

    if (companies < 1 || companies > 100) {
      throw new ValidationError({
        message: "Number of companies must be between 1 and 100",
      });
    }

    if (consumers < 1 || consumers > 10000) {
      throw new ValidationError({
        message: "Number of consumers must be between 1 and 10000",
      });
    }

    // Inicializa a barra de progresso
    progressBar = new cliProgress.SingleBar({
      format: "Progress |{bar}| {percentage}% | {value}/{total} | {stage}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    progressBar.start(5, 0, { stage: "Iniciando..." });

    // Step 1: Fetch random addresses from Google Places API
    progressBar.update(1, { stage: "Buscando endereços..." });
    const addresses = await fetchRandomAddresses(Math.max(companies, 20));

    // Step 2: Get existing segments from database
    progressBar.update(2, { stage: "Carregando segmentos..." });
    const segments = await getExistingSegments();

    // Step 3: Create companies with users and cards
    progressBar.update(3, { stage: "Criando empresas, usuários e cartões..." });
    const createdCompanies = await createCompanies(companies, segments, addresses);

    // Step 4: Create consumers with credits
    progressBar.update(4, { stage: "Criando consumidores..." });
    const createdConsumers = await createConsumers(consumers, createdCompanies, addresses);

    // Step 5: Create credits for consumers
    progressBar.update(5, { stage: "Criando créditos..." });
    const createdCredits = await createCredits(createdConsumers, createdCompanies);

    progressBar.stop();

    const summary = {
      companies: createdCompanies.companies?.length || 0,
      users: {
        consumers: createdConsumers?.length || 0,
        clients: createdCompanies.users?.length || 0,
        total: (createdCompanies.users?.length || 0) + (createdConsumers?.length || 0),
      },
      cards: createdCompanies.cards?.length || 0,
      credits: createdCredits.length,
    };

    return res.status(200).json({
      message: "Load test data generated successfully",
      summary,
    });
  } catch (error) {
    if (progressBar) progressBar.stop();
    next(error);
  }
}

async function getExistingSegments() {
  const existingSegments = await segmentHandler.list({
    filter: { status: statusConsts.RESOURCE_STATUS.AVAILABLE, excluded: false },
  });

  if (existingSegments.length === 0) {
    throw new Error("No segments found in database. Please create segments first.");
  }

  return existingSegments;
}

async function createCompanies(count, segments, addresses) {
  const companiesData = [];
  const allUsersData = [];
  const allCardsData = [];

  for (let i = 0; i < count; i++) {
    const address = addresses[i % addresses.length];
    const segment = segments[i % segments.length];
    const randomValue = Math.random();
    let status, excluded;
    if (randomValue < 0.05) {
      excluded = true;
      status = statusConsts.RESOURCE_STATUS.AVAILABLE;
    } else if (randomValue < 0.15) {
      excluded = false;
      status = statusConsts.RESOURCE_STATUS.UNAVAILABLE;
    } else {
      excluded = false;
      status = statusConsts.RESOURCE_STATUS.AVAILABLE;
    }
    companiesData.push(
      createDummyCompany({
        name: address.name,
        address: {
          ...address,
          number: address.number + i,
          location: {
            type: "Point",
            coordinates: [
              address.coordinates.lng + (Math.random() - 0.5) * 0.01,
              address.coordinates.lat + (Math.random() - 0.5) * 0.01,
            ],
          },
        },
        segment: {
          _id: segment._id,
          name: segment.name,
          icon: segment.icon,
          description: segment.description,
          status: segment.status,
          excluded: segment.excluded,
        },
        status,
        excluded,
      }),
    );
  }
  const createdCompanies = await companyHandler.createMany({ data: companiesData });

  const usersPerCompany = [];
  for (let i = 0; i < createdCompanies.length; i++) {
    const userCount = faker.number.int({ min: 1, max: 3 });
    usersPerCompany.push(userCount);
  }
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i];
    const userCount = usersPerCompany[i];
    const users = [];
    for (let j = 0; j < userCount; j++) {
      users.push(
        createDummyUser({
          password: "caramelo",
          role: roleConstants.USER_ROLES.CLIENT,
          company_id: company._id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          excluded: false,
        }),
      );
    }
    allUsersData.push(...(await Promise.all(users)));
  }
  const createdUsers = await userHandler.createMany({ data: allUsersData });

  const cardsPerCompany = [];
  for (let i = 0; i < createdCompanies.length; i++) {
    const cardCount = faker.number.int({ min: 1, max: 2 });
    cardsPerCompany.push(cardCount);
  }
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i];
    const cardCount = cardsPerCompany[i];
    const cards = [];
    for (let k = 0; k < cardCount; k++) {
      const cardRandomValue = Math.random();
      let cardStatus, cardExcluded;
      if (cardRandomValue < 0.05) {
        cardExcluded = true;
        cardStatus = statusConsts.RESOURCE_STATUS.AVAILABLE;
      } else if (cardRandomValue < 0.1) {
        cardExcluded = false;
        cardStatus = statusConsts.RESOURCE_STATUS.UNAVAILABLE;
      } else {
        cardExcluded = false;
        cardStatus = statusConsts.RESOURCE_STATUS.AVAILABLE;
      }
      let refNumber, refType;
      const typeRandom = Math.random();
      if (typeRandom < 0.33) {
        refType = datesConstants.TYPES.DAY;
        refNumber = faker.number.int({ min: 1, max: 30 });
      } else if (typeRandom < 0.66) {
        refType = datesConstants.TYPES.MONTH;
        refNumber = faker.number.int({ min: 1, max: 12 });
      } else {
        refType = datesConstants.TYPES.YEAR;
        refNumber = 1;
      }
      cards.push(
        createDummyCard({
          company_id: company._id,
          credits_needed: faker.number.int({ min: 1, max: 10 }),
          credit_expires_at: { ref_number: refNumber, ref_type: refType },
          status: cardStatus,
          excluded: cardExcluded,
        }),
      );
    }
    allCardsData.push(...cards);
  }
  const createdCards = await cardHandler.createMany({ data: allCardsData });

  // Retorna os dados estruturados corretamente
  return {
    companies: createdCompanies,
    users: createdUsers,
    cards: createdCards,
  };
}

async function createConsumers(count, companies, addresses) {
  const allCards = companies.cards || [];
  const consumersData = [];
  for (let i = 0; i < count; i++) {
    const randomValue = Math.random();
    let status, excluded;
    if (randomValue < 0.05) {
      excluded = true;
      status = statusConsts.RESOURCE_STATUS.AVAILABLE;
    } else if (randomValue < 0.15) {
      excluded = false;
      status = statusConsts.RESOURCE_STATUS.UNAVAILABLE;
    } else {
      excluded = false;
      status = statusConsts.RESOURCE_STATUS.AVAILABLE;
    }
    consumersData.push(
      createDummyUser({
        password: "caramelo",
        role: roleConstants.USER_ROLES.CONSUMER,
        status,
        excluded,
      }),
    );
  }
  const resolvedConsumersData = await Promise.all(consumersData);
  const createdConsumers = await userHandler.createMany({ data: resolvedConsumersData });
  if (!Array.isArray(createdConsumers)) {
    throw createdConsumers;
  }
  const consumersWithRelations = createdConsumers.map((consumer, index) => ({
    consumer,
    address: addresses[index % addresses.length],
    cards: allCards,
  }));
  return consumersWithRelations;
}

async function createCredits(consumers, companies) {
  const creditsData = [];
  for (const consumerData of consumers) {
    const creditCount = faker.number.int({ min: 1, max: 15 });
    const selectedCards = faker.helpers.arrayElements(consumerData.cards, creditCount);
    for (const card of selectedCards) {
      const company = companies.companies?.find((c) =>
        companies.cards?.some(
          (companyCard) => companyCard._id.equals(card._id) && companyCard.company_id.equals(c._id),
        ),
      );
      if (!company) continue;
      const randomValue = Math.random();
      let status;
      if (randomValue < 0.5) {
        status = statusConsts.CREDITS_STATUS.AVAILABLE;
      } else if (randomValue < 0.8) {
        status = statusConsts.CREDITS_STATUS.USED;
      } else if (randomValue < 0.9) {
        status = statusConsts.CREDITS_STATUS.REJECTED;
      } else {
        status = statusConsts.CREDITS_STATUS.PENDING;
      }
      const expiresAt = dateUtils.addTime(
        new Date(),
        card.credit_expires_at.ref_number,
        card.credit_expires_at.ref_type,
      );
      creditsData.push(
        createDummyCredit({
          user_id: consumerData.consumer._id,
          card_id: card._id,
          company_id: company._id,
          status,
          excluded: false,
          requested_at: status === statusConsts.CREDITS_STATUS.PENDING ? new Date() : null,
          expires_at: expiresAt,
        }),
      );
    }
  }
  const createdCredits = await creditHandler.createMany({ data: creditsData });
  return createdCredits;
}

module.exports = {
  generateLoadTestData,
};
