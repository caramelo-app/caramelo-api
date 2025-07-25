const { ValidationError } = require("../infra/errors");
const dbHandler = require("../utils/db-handler.utils");
const { fakerPT_BR: faker } = require("@faker-js/faker");

// Models
const companyModel = require("../models/company.model");
const userModel = require("../models/user.model");
const cardModel = require("../models/card.model");
const creditModel = require("../models/credit.model");
const segmentModel = require("../models/segment.model");

// Constants
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");
const datesConstants = require("../constants/dates.constants");

// Utils
const { generateCNPJ, generatePhoneNumber } = require("../utils/data.utils");
const dateUtils = require("../utils/date.utils");

// Handlers
const companyHandler = dbHandler(companyModel);
const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const segmentHandler = dbHandler(segmentModel);

// Function to fetch random addresses from Google Places API
async function fetchRandomAddresses(count = 20) {
  const response = await fetch(
    `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/utils/places?city=Curitiba&state=PR&count=${count}`
  );
  
  if (response.status !== 200) {
    throw new Error(`Failed to fetch addresses from Google Places API: ${response.status} ${response.statusText}`);
  }
  
  const addresses = await response.json();
  
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("No addresses returned from Google Places API");
  }
  
  console.log(`Successfully fetched ${addresses.length} addresses from Google Places API`);
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

    console.log(`Starting load test data generation: ${companies} companies, ${consumers} consumers`);

    // Step 1: Fetch random addresses from Google Places API
    const addresses = await fetchRandomAddresses(Math.max(companies, 20));

    // Step 2: Get existing segments from database
    const segments = await getExistingSegments();

    // Step 3: Create companies with users and cards
    const createdCompanies = await createCompanies(companies, segments, addresses);

    // Step 4: Create consumers with credits
    const createdConsumers = await createConsumers(consumers, createdCompanies, addresses);

    // Step 5: Create credits for consumers
    const createdCredits = await createCredits(createdConsumers, createdCompanies);

    const summary = {
      companies: createdCompanies.length,
      users: createdCompanies.reduce((acc, company) => acc + company.users.length, 0) + createdConsumers.length,
      cards: createdCompanies.reduce((acc, company) => acc + company.cards.length, 0),
      credits: createdCredits.length,
    };

    console.log(`Load test data generation completed:`, summary);

    return res.status(200).json({
      message: "Load test data generated successfully",
      summary,
    });
  } catch (error) {
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
  // Prepare all companies data
  const companiesData = [];
  const allUsersData = [];
  const allCardsData = [];

  for (let i = 0; i < count; i++) {
    const address = addresses[i % addresses.length];
    const segment = segments[i % segments.length];

    // Determine company status and excluded based on percentages
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

    // Prepare company data
    companiesData.push({
      name: address.name || faker.company.name(), // Use real place name if available
      phone: generatePhoneNumber(),
      address: {
        street: address.street,
        number: address.number + i, // Make each address unique
        complement: faker.location.secondaryAddress(),
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zipcode: address.zipcode,
        location: {
          type: "Point",
          coordinates: [
            address.coordinates.lng + (Math.random() - 0.5) * 0.01,
            address.coordinates.lat + (Math.random() - 0.5) * 0.01,
          ],
        },
      },
      logo: "https://via.placeholder.com/150",
      segment: {
        _id: segment._id,
        name: segment.name,
        icon: segment.icon,
        description: segment.description,
        status: segment.status,
        excluded: segment.excluded,
      },
      status,
      document: generateCNPJ(),
      excluded,
    });
  }

  // Create all companies in batch
  console.log(`Creating ${count} companies in batch...`);
  const createdCompanies = await companyHandler.createMany({
    data: companiesData,
  });

  // Prepare users and cards data for all companies
  const companiesWithRelations = [];
  
  for (let i = 0; i < createdCompanies.length; i++) {
    const company = createdCompanies[i];
    
    // Prepare users data for this company
    const userCount = faker.number.int({ min: 1, max: 3 });
    const users = [];
    for (let j = 0; j < userCount; j++) {
      allUsersData.push({
        name: faker.person.fullName(),
        phone: generatePhoneNumber(),
        password: "caramelo",
        role: roleConstants.USER_ROLES.CLIENT,
        company_id: company._id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      });
      users.push({ index: allUsersData.length - 1, company_id: company._id });
    }

    // Prepare cards data for this company
    const cardCount = faker.number.int({ min: 1, max: 2 });
    const cards = [];
    for (let k = 0; k < cardCount; k++) {
      // Determine card status and excluded based on percentages
      const cardRandomValue = Math.random();
      let cardStatus, cardExcluded;
      
      if (cardRandomValue < 0.05) {
        cardExcluded = true;
        cardStatus = statusConsts.RESOURCE_STATUS.AVAILABLE;
      } else if (cardRandomValue < 0.10) {
        cardExcluded = false;
        cardStatus = statusConsts.RESOURCE_STATUS.UNAVAILABLE;
      } else {
        cardExcluded = false;
        cardStatus = statusConsts.RESOURCE_STATUS.AVAILABLE;
      }

      // Generate credit expiration with year limit
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
        refNumber = 1; // Maximum 1 year as requested
      }

      allCardsData.push({
        title: faker.commerce.productName(),
        company_id: company._id,
        credits_needed: faker.number.int({ min: 1, max: 10 }),
        credit_expires_at: {
          ref_number: refNumber,
          ref_type: refType,
        },
        status: cardStatus,
        excluded: cardExcluded,
      });
      cards.push({ index: allCardsData.length - 1, company_id: company._id });
    }

    companiesWithRelations.push({
      company,
      users,
      cards,
    });
  }

  // Create all users in batch
  console.log(`Creating ${allUsersData.length} users in batch...`);
  const createdUsers = await userHandler.createMany({
    data: allUsersData,
  });

  // Create all cards in batch
  console.log(`Creating ${allCardsData.length} cards in batch...`);
  const createdCards = await cardHandler.createMany({
    data: allCardsData,
  });

  // Map created users and cards back to companies
  let userIndex = 0;
  let cardIndex = 0;
  
  for (const companyRelation of companiesWithRelations) {
    // Map users
    companyRelation.users = companyRelation.users.map(() => createdUsers[userIndex++]);
    
    // Map cards
    companyRelation.cards = companyRelation.cards.map(() => createdCards[cardIndex++]);
  }

  console.log(`Created ${count} companies with users and cards`);
  return companiesWithRelations;
}

async function createConsumers(count, companies, addresses) {
  const allCards = companies.flatMap(c => c.cards);
  const consumersData = [];

  // Prepare all consumers data
  for (let i = 0; i < count; i++) {
    addresses[i % addresses.length];

    // Determine consumer status and excluded based on percentages
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

    consumersData.push({
      name: faker.person.fullName(),
      phone: generatePhoneNumber(),
      password: "caramelo",
      role: roleConstants.USER_ROLES.CONSUMER,
      status,
      excluded,
    });
  }

  // Create all consumers in batch
  console.log(`Creating ${count} consumers in batch...`);
  const createdConsumers = await userHandler.createMany({
    data: consumersData,
  });

  // Map consumers with their addresses and cards
  const consumersWithRelations = createdConsumers.map((consumer, index) => ({
    consumer,
    address: addresses[index % addresses.length],
    cards: allCards,
  }));

  console.log(`Created ${count} consumers`);
  return consumersWithRelations;
}

async function createCredits(consumers, companies) {
  const creditsData = [];

  for (const consumerData of consumers) {
    // Each consumer gets 1-15 credits from different companies
    const creditCount = faker.number.int({ min: 1, max: 15 });
    const selectedCards = faker.helpers.arrayElements(consumerData.cards, creditCount);

    for (const card of selectedCards) {
      const company = companies.find(c => c.cards.some(companyCard => companyCard._id.equals(card._id)));
      if (!company) continue;

      // Determine credit status based on percentages
      const randomValue = Math.random();
      let status;
      
      if (randomValue < 0.50) {
        status = statusConsts.CREDITS_STATUS.AVAILABLE;
      } else if (randomValue < 0.80) {
        status = statusConsts.CREDITS_STATUS.USED;
      } else if (randomValue < 0.90) {
        status = statusConsts.CREDITS_STATUS.REJECTED;
      } else {
        status = statusConsts.CREDITS_STATUS.PENDING;
      }

      const expiresAt = dateUtils.addTime(
        new Date(),
        card.credit_expires_at.ref_number,
        card.credit_expires_at.ref_type,
      );

      creditsData.push({
        user_id: consumerData.consumer._id,
        card_id: card._id,
        company_id: company.company._id,
        status,
        excluded: false,
        requested_at: status === statusConsts.CREDITS_STATUS.PENDING ? new Date() : null,
        expires_at: expiresAt,
      });
    }
  }

  // Create all credits in batch
  console.log(`Creating ${creditsData.length} credits in batch...`);
  const createdCredits = await creditHandler.createMany({
    data: creditsData,
  });

  console.log(`Created ${createdCredits.length} credits`);
  return createdCredits;
}

module.exports = {
  generateLoadTestData,
}; 