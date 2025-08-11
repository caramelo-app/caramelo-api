const dateUtils = require("../utils/date.utils");
const mongoose = require("mongoose");
const userModel = require("../models/user.model");
const cardModel = require("../models/card.model");
const creditModel = require("../models/credit.model");
const dbHandler = require("../utils/db-handler.utils");
const companyModel = require("../models/company.model");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");
const datesConstants = require("../constants/dates.constants");

const { subTime, processWeeklyStats } = require("../utils/date.utils");
const { localize } = require("../utils/localization.utils");
const { NotFoundError, ForbiddenError, ValidationError, UnauthorizedError } = require("../infra/errors");
const {
  getClientConsumersAggregation,
  getNewClientsAggregationLast4Weeks,
} = require("../aggregations/companies.aggregation");
const { validatePhone } = require("../utils/validation.utils");

const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const companyHandler = dbHandler(companyModel);

/**
 * @swagger
 * /v1/companies/explore:
 *   get:
 *     summary: Explore companies
 *     description: Find companies near a specific location
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *         example: -23.5505
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *         example: -46.6333
 *       - in: query
 *         name: distance
 *         schema:
 *           type: number
 *         description: Search radius in kilometers (max 10km)
 *         example: 5
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of results to return
 *         example: 20
 *       - in: query
 *         name: skip
 *         schema:
 *           type: number
 *         description: Number of results to skip
 *         example: 0
 *       - in: query
 *         name: segments
 *         schema:
 *           type: string
 *         description: Comma-separated list of segment IDs to filter by
 *         example: "65f0c9e1b1a2f3c4d5e6a7b8,65f0c9e1b1a2f3c4d5e6a7b9"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to match company name or segment name (case-insensitive)
 *         example: "barbearia"
 *     responses:
 *       200:
 *         description: Companies found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   segment:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                   logo:
 *                     type: string
 *                   address:
 *                     type: object
 *       400:
 *         description: Invalid coordinates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a consumer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function exploreCompanies(req, res, next) {
  try {
    let { latitude, longitude, distance, limit, skip, segments, search } = req.query;

    // Validate required parameters
    if (!latitude || !longitude) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "latitude and longitude" }),
      });
    }

    // Validate coordinate format
    const lat = typeof latitude === "string" ? parseFloat(latitude) : Number(latitude);
    const lng = typeof longitude === "string" ? parseFloat(longitude) : Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new ValidationError({
        message: localize("error.generic.invalidFormat", { field: "coordinates" }),
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ValidationError({
        message: localize("error.generic.invalidFormat", { field: "coordinates" }),
      });
    }

    if (!distance) {
      distance = parseFloat(process.env.EXPLORE_DEFAULT_DISTANCE) || 5;
    } else {
      distance = typeof distance === "string" ? parseFloat(distance) : Number(distance);
      if (isNaN(distance) || distance <= 0) {
        distance = parseFloat(process.env.EXPLORE_DEFAULT_DISTANCE) || 5;
      }
      if (distance > 10) {
        distance = 10;
      }
    }

    if (!limit) {
      limit = parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 20;
    } else {
      limit = typeof limit === "string" ? parseInt(limit) : Number(limit);
    }

    if (!skip) {
      skip = 0;
    } else {
      skip = typeof skip === "string" ? parseInt(skip) : Number(skip);
    }

    const filter = {
      "address.location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: distance * 1000,
        },
      },
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    };

    // Optional segments filter (accepts comma-separated string or repeated params)
    if (segments) {
      const segmentsArrayRaw = Array.isArray(segments)
        ? segments
        : String(segments)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      const segmentsArray = segmentsArrayRaw.map((s) =>
        mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : s,
      );
      if (segmentsArray.length > 0) {
        filter["segment._id"] = { $in: segmentsArray };
      }
    }

    // Optional case-insensitive search by company name or segment name
    const searchTerm = typeof search === "string" ? search.trim() : "";
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { "segment.name": { $regex: searchTerm, $options: "i" } },
      ];
    }

    const companyListOptions = {
      filter,
      projection: {
        name: 1,
        "segment.name": 1,
        "segment._id": 1,
        logo: 1,
        address: 1,
      },
      limit,
      skip,
    };

    const companies = await companyHandler.list(companyListOptions);

    return res.status(200).json(companies);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/cards:
 *   get:
 *     summary: Get company cards
 *     description: Retrieve all cards created by the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company cards retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   credits_needed:
 *                     type: number
 *                   credit_expires_at:
 *                     type: object
 *                     properties:
 *                       ref_number:
 *                         type: number
 *                       ref_type:
 *                         type: string
 *                   status:
 *                     type: string
 *                   count:
 *                     type: object
 *                     properties:
 *                       credits:
 *                         type: number
 *                       consumers:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyCards(req, res, next) {
  try {
    const { company_id } = req.user;

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    const cardHandlerOptions = {
      filter: {
        company_id,
        excluded: false,
      },
      projection: {
        title: 1,
        credits_needed: 1,
        credit_expires_at: 1,
        status: 1,
      },
    };

    const cards = await cardHandler.list(cardHandlerOptions);

    let cardsWithCount = [];

    const creditList = await creditHandler.list({
      filter: { card_id: { $in: cards.map((card) => card._id) } },
      projection: {
        card_id: 1,
        user_id: 1,
      },
    });

    for (const card of cards) {
      const creditsForCard = creditList.filter((credit) => credit.card_id.toString() === card._id.toString());
      const uniqueUsers = new Set(creditsForCard.map((credit) => credit.user_id.toString()));

      const cardWithCount = {
        ...card,
        count: {
          credits: creditsForCard.length,
          consumers: uniqueUsers.size,
        },
      };

      cardsWithCount.push(cardWithCount);
    }

    return res.status(200).json(cardsWithCount);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/profile:
 *   get:
 *     summary: Get company profile
 *     description: Retrieve the authenticated company's profile information
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Company'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyProfile(req, res, next) {
  try {
    const { company_id } = req.user;

    if (!company_id) {
      throw new ForbiddenError();
    }

    const company = await validateCompany({
      company_id,
      projection: {
        name: 1,
        logo: 1,
        address: 1,
        segment: {
          _id: 1,
          name: 1,
          description: 1,
          icon: 1,
        },
        phone: 1,
        document: 1,
        status: 1,
        excluded: 1,
      },
    });

    return res.status(200).json(company);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/profile:
 *   patch:
 *     summary: Update company profile
 *     description: Update the authenticated company's profile information
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Company name
 *                 example: "Restaurante Exemplo"
 *               phone:
 *                 type: string
 *                 description: Company phone number
 *                 example: "5511999999999"
 *               address:
 *                 type: object
 *                 description: Company address
 *               logo:
 *                 type: string
 *                 description: Company logo URL
 *     responses:
 *       200:
 *         description: Company profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Company profile updated successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateCompanyProfile(req, res, next) {
  try {
    const { company_id } = req.user;
    const { name, phone, address, logo } = req.body;

    if (!name && !phone && !address && !logo) {
      throw new ValidationError();
    }

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    const allowedFields = ["name", "phone", "address", "logo"];

    const data = allowedFields.reduce((acc, field) => {
      if (req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    await companyHandler.update({
      filter: {
        _id: company_id,
      },
      data,
    });

    return res.status(200).json({
      message: localize("companies.profile.update.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers:
 *   get:
 *     summary: Get company consumers
 *     description: Retrieve all consumers who have credits from the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of results to return
 *         example: 10
 *       - in: query
 *         name: skip
 *         schema:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip
 *         example: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or phone
 *         example: "João"
 *     responses:
 *       200:
 *         description: Company consumers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   lastCreditDate:
 *                     type: string
 *                     format: date-time
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getConsumers(req, res, next) {
  try {
    const { company_id } = req.user;
    let { limit, skip, search } = req.query;

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    if (limit) {
      limit = parseInt(limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError({
          message: localize("error.generic.invalid", { field: "limit" }),
        });
      }
    } else {
      limit = parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 10;
    }

    if (skip) {
      skip = parseInt(skip);
      if (isNaN(skip) || skip < 0) {
        throw new ValidationError({
          message: localize("error.generic.invalid", { field: "skip" }),
        });
      }
    } else {
      skip = 0;
    }

    const consumers = await creditHandler.aggregate({
      pipeline: getClientConsumersAggregation({
        company_id,
        limit,
        skip,
        search: search?.trim(),
      }),
    });

    return res.status(200).json(consumers);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}:
 *   get:
 *     summary: Get consumer by ID
 *     description: Retrieve detailed information about a specific consumer
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *     responses:
 *       200:
 *         description: Consumer details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 consumer:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 cards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       credits_needed:
 *                         type: number
 *                       credits:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             created_at:
 *                               type: string
 *                               format: date-time
 *                             user_id:
 *                               type: string
 *                             status:
 *                               type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Consumer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getConsumerById(req, res, next) {
  try {
    let response = {};
    const { company_id } = req.user;
    const { consumer_id } = req.params;

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    const consumerReadOptions = {
      filter: {
        _id: consumer_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        name: 1,
        phone: 1,
        created_at: 1,
      },
    };

    const consumer = await userHandler.read(consumerReadOptions);

    if (!consumer) {
      throw new NotFoundError({
        message: localize("error.generic.notFound", { resource: localize("resources.consumer") }),
      });
    }

    const creditHandlerOptions = {
      filter: {
        user_id: consumer._id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        created_at: 1,
        card_id: 1,
        user_id: 1,
        status: 1,
      },
    };

    const credits = await creditHandler.list(creditHandlerOptions);

    let cardIds = credits.map((credit) => credit.card_id.toString());
    cardIds = [...new Set(cardIds)];

    const cardHandlerOptions = {
      filter: {
        company_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
        _id: { $in: cardIds },
      },
      projection: {
        title: 1,
        credits_needed: 1,
      },
    };

    const cardsList = await cardHandler.list(cardHandlerOptions);

    let cards = [];

    for (const card of cardsList) {
      cards.push({
        _id: card._id,
        title: card.title,
        credits_needed: card.credits_needed,
        credits: credits
          .filter((credit) => credit.card_id.toString() === card._id.toString())
          .map((credit) => ({
            _id: credit._id,
            created_at: credit.created_at,
            user_id: credit.user_id,
            status: credit.status,
          })),
      });
    }

    response = {
      consumer,
      cards,
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers:
 *   post:
 *     summary: Create consumer
 *     description: Create a new consumer and optionally assign credits
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 description: Consumer name
 *                 example: "João Silva"
 *               phone:
 *                 type: string
 *                 description: Consumer phone number
 *                 example: "5511999999999"
 *               credits:
 *                 type: array
 *                 description: Credits to assign to the consumer
 *                 items:
 *                   type: object
 *                   properties:
 *                     card_id:
 *                       type: string
 *                       description: Card ID
 *                     quantity:
 *                       type: number
 *                       description: Number of credits
 *                       example: 5
 *     responses:
 *       200:
 *         description: Consumer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Consumer created successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function createConsumer(req, res, next) {
  try {
    const { company_id } = req.user;
    const { name, phone, credits = [] } = req.body;

    if (!phone) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "phone" }),
      });
    }

    if (!validatePhone(phone)) {
      throw new ValidationError({
        message: localize("error.generic.invalidFormat", { field: "phone" }),
      });
    }

    await validateCompany({
      company_id,
    });

    if (credits && credits.length > 0) {
      await validateCredits({
        company_id,
        credits,
      });
    }

    const userHandlerOptions = {
      filter: {
        phone,
        role: roleConstants.USER_ROLES.CONSUMER,
      },
    };

    const userCheck = await userHandler.read(userHandlerOptions);

    if (userCheck) {
      throw new ValidationError({
        message: localize("error.generic.alreadyExists", { resource: localize("resources.user") }),
      });
    }

    const userData = {
      phone,
      role: roleConstants.USER_ROLES.CONSUMER,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    };

    if (name) {
      userData.name = name;
    }

    const userCreateOptions = {
      data: userData,
    };

    const user = await userHandler.create(userCreateOptions);

    if (credits && credits.length > 0) {
      const cardIds = credits.map((credit) => credit.card_id);

      const cardHandlerOptions = {
        filter: {
          _id: { $in: cardIds },
        },
        projection: {
          _id: 1,
          credit_expires_at: 1,
        },
      };

      const cards = await cardHandler.list(cardHandlerOptions);

      if (credits.length > 0) {
        const bulkCredits = [];

        for (const credit of credits) {
          const card = cards.find((c) => c._id.toString() === credit.card_id.toString());

          for (let i = 0; i < credit.quantity; i++) {
            const expires_at = dateUtils.addTime(
              new Date(),
              card.credit_expires_at.ref_number,
              card.credit_expires_at.ref_type,
            );

            bulkCredits.push({
              user_id: user._id,
              card_id: credit.card_id,
              status: statusConsts.CREDITS_STATUS.AVAILABLE,
              company_id,
              expires_at,
            });
          }
        }

        await creditHandler.createMany({
          data: bulkCredits,
        });
      }
    }

    return res.status(200).json({
      message: localize("companies.consumers.create.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}:
 *   patch:
 *     summary: Update consumer
 *     description: Update consumer information
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Consumer name
 *                 example: "João Silva"
 *               phone:
 *                 type: string
 *                 description: Consumer phone number
 *                 example: "5511999999999"
 *     responses:
 *       200:
 *         description: Consumer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Consumer updated successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Consumer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateConsumer(req, res, next) {
  try {
    const { company_id } = req.user;
    const { consumer_id } = req.params;
    const { name, phone } = req.body;

    if (!name && !phone) {
      throw new ValidationError();
    }

    await validateCompany({
      company_id,
    });

    const consumerReadOptions = {
      filter: {
        _id: consumer_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const consumer = await userHandler.read(consumerReadOptions);

    if (!consumer) {
      throw new NotFoundError({
        message: localize("error.generic.notFound", { resource: localize("resources.consumer") }),
      });
    }

    const allowedFields = ["name", "phone"];

    const data = allowedFields.reduce((acc, field) => {
      if (req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    const consumerUpdateOptions = {
      filter: {
        _id: consumer_id,
      },
      data,
    };

    await userHandler.update(consumerUpdateOptions);

    return res.status(200).json({
      message: localize("companies.consumers.update.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}/credits:
 *   patch:
 *     summary: Update consumer credits
 *     description: Add credits to a specific consumer
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credits
 *             properties:
 *               credits:
 *                 type: array
 *                 description: Credits to add to the consumer
 *                 items:
 *                   type: object
 *                   properties:
 *                     card_id:
 *                       type: string
 *                       description: Card ID
 *                       example: "507f1f77bcf86cd799439011"
 *                     quantity:
 *                       type: number
 *                       description: Number of credits
 *                       example: 5
 *     responses:
 *       200:
 *         description: Consumer credits updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Consumer credits updated successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Consumer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateConsumerCredits(req, res, next) {
  try {
    const { company_id } = req.user;
    const { consumer_id } = req.params;
    const { credits } = req.body;

    if (!company_id) {
      throw new ForbiddenError();
    }

    if (!credits) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "credits" }),
      });
    }

    await validateCredits({
      company_id,
      credits,
    });

    await validateCompany({
      company_id,
    });

    const userHandlerOptions = {
      filter: {
        _id: consumer_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const userCheck = await userHandler.read(userHandlerOptions);

    if (!userCheck) {
      throw new UnauthorizedError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.user") }),
      });
    }

    // Create the credits
    if (credits && credits.length > 0) {
      const cardIds = credits.map((credit) => credit.card_id);

      const cardHandlerOptions = {
        filter: {
          _id: { $in: cardIds },
          company_id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          excluded: false,
        },
        projection: {
          _id: 1,
          credit_expires_at: 1,
        },
      };

      const cards = await cardHandler.list(cardHandlerOptions);

      const bulkCredits = [];

      for (const credit of credits) {
        const card = cards.find((c) => c._id.toString() === credit.card_id.toString());

        if (!card) {
          throw new ValidationError({
            message: localize("error.generic.notFound", { resource: localize("resources.card") }),
          });
        }

        for (let i = 0; i < credit.quantity; i++) {
          const expires_at = dateUtils.addTime(
            new Date(),
            card.credit_expires_at.ref_number,
            card.credit_expires_at.ref_type,
          );

          bulkCredits.push({
            user_id: consumer_id,
            card_id: credit.card_id,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            company_id,
            expires_at,
          });
        }
      }

      if (bulkCredits.length > 0) {
        await creditHandler.createMany({
          data: bulkCredits,
        });
      }
    }

    return res.status(200).json({
      message: localize("companies.consumers.updateCredits.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/cards:
 *   post:
 *     summary: Create company card
 *     description: Create a new card for the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - credits_needed
 *               - credit_expires_at
 *             properties:
 *               title:
 *                 type: string
 *                 description: Card title
 *                 example: "Desconto 20%"
 *               credits_needed:
 *                 type: number
 *                 description: Number of credits needed to redeem
 *                 example: 5
 *               credit_expires_at:
 *                 type: object
 *                 description: Credit expiration configuration
 *                 properties:
 *                   ref_number:
 *                     type: number
 *                     description: Number of time units
 *                     example: 30
 *                   ref_type:
 *                     type: string
 *                     description: Time unit type
 *                     enum: [days, weeks, months, years]
 *                     example: "days"
 *     responses:
 *       200:
 *         description: Card created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Card'
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function createCompanyCard(req, res, next) {
  try {
    const { company_id } = req.user;
    const { title, credits_needed, credit_expires_at } = req.body;

    // Validate required fields
    if (!title) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "title" }),
      });
    }

    if (!credits_needed || credits_needed <= 0) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "credits_needed" }),
      });
    }

    if (!credit_expires_at || !credit_expires_at.ref_number || !credit_expires_at.ref_type) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "credit_expires_at" }),
      });
    }

    // Validate ref_type - only accept types defined in constants
    const validRefTypes = [datesConstants.TYPES.DAY, datesConstants.TYPES.MONTH, datesConstants.TYPES.YEAR];
    if (!validRefTypes.includes(credit_expires_at.ref_type)) {
      throw new ValidationError({
        message: localize("error.generic.invalidFormat", { field: "credit_expires_at.ref_type" }),
      });
    }

    await validateCompany({
      company_id,
    });

    const cardHandlerOptions = {
      data: {
        title,
        credits_needed,
        credit_expires_at: {
          ref_number: credit_expires_at.ref_number,
          ref_type: credit_expires_at.ref_type,
        },
        company_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const card = await cardHandler.create(cardHandlerOptions);

    return res.status(200).json(card);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/cards/{card_id}:
 *   patch:
 *     summary: Update company card
 *     description: Update an existing card for the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: card_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Card ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Card title
 *                 example: "Desconto 25%"
 *               credits_needed:
 *                 type: number
 *                 description: Number of credits needed to redeem
 *                 example: 10
 *               credit_expires_at:
 *                 type: object
 *                 description: Credit expiration configuration
 *                 properties:
 *                   ref_number:
 *                     type: number
 *                     description: Number of time units
 *                     example: 60
 *                   ref_type:
 *                     type: string
 *                     description: Time unit type
 *                     enum: [days, weeks, months, years]
 *                     example: "days"
 *     responses:
 *       200:
 *         description: Card updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Card'
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Card not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateCompanyCard(req, res, next) {
  try {
    const { company_id } = req.user;
    const { card_id } = req.params;

    await validateCompany({
      company_id,
    });

    await validateCard({
      card_id,
      company_id,
    });

    // Validate credit_expires_at if provided
    if (req.body.credit_expires_at) {
      const { ref_number, ref_type } = req.body.credit_expires_at;

      if (!ref_number || !ref_type) {
        throw new ValidationError({
          message: localize("error.generic.required", { field: "credit_expires_at" }),
        });
      }

      // Validate ref_type - only accept types defined in constants
      const validRefTypes = [datesConstants.TYPES.DAY, datesConstants.TYPES.MONTH, datesConstants.TYPES.YEAR];
      if (!validRefTypes.includes(ref_type)) {
        throw new ValidationError({
          message: localize("error.generic.invalidFormat", { field: "credit_expires_at.ref_type" }),
        });
      }
    }

    const allowedFields = ["title", "credits_needed", "credit_expires_at"];

    const data = allowedFields.reduce((acc, field) => {
      if (req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    const cardUpdateOptions = {
      filter: {
        _id: card_id,
      },
      data,
    };

    const cardUpdate = await cardHandler.update(cardUpdateOptions);

    return res.status(200).json(cardUpdate);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/cards/{card_id}:
 *   get:
 *     summary: Get company card by ID
 *     description: Retrieve detailed information about a specific card
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: card_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Card ID
 *     responses:
 *       200:
 *         description: Card details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 credits_needed:
 *                   type: number
 *                 credit_expires_at:
 *                   type: object
 *                   properties:
 *                     ref_number:
 *                       type: number
 *                     ref_type:
 *                       type: string
 *                 status:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 stats:
 *                   type: object
 *                   properties:
 *                     credits:
 *                       type: number
 *                       description: Total number of credits for this card
 *                     consumers:
 *                       type: number
 *                       description: Number of unique consumers with this card
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Card not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyCardById(req, res, next) {
  try {
    const { company_id } = req.user;
    const { card_id } = req.params;

    await validateCompany({
      company_id,
    });

    const card = await validateCard({
      card_id,
      company_id,
      projection: {
        _id: 1,
        title: 1,
        credits_needed: 1,
        credit_expires_at: 1,
        status: 1,
        created_at: 1,
      },
    });

    // Get credit statistics for this card
    const creditList = await creditHandler.list({
      filter: {
        card_id: card_id,
        excluded: false,
        status: {
          $in: [statusConsts.CREDITS_STATUS.AVAILABLE, statusConsts.CREDITS_STATUS.USED],
        },
      },
      projection: {
        card_id: 1,
        user_id: 1,
      },
    });

    const uniqueUsers = new Set(creditList.map((credit) => credit.user_id.toString()));

    const cardWithStats = {
      ...card,
      stats: {
        credits: creditList.length,
        consumers: uniqueUsers.size,
      },
    };

    return res.status(200).json(cardWithStats);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/cards/{card_id}:
 *   delete:
 *     summary: Delete company card
 *     description: Delete a card from the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: card_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Card ID
 *     responses:
 *       200:
 *         description: Card deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Card deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Card not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function deleteCompanyCard(req, res, next) {
  try {
    const { company_id } = req.user;
    const { card_id } = req.params;

    await validateCompany({
      company_id,
    });

    await validateCard({
      card_id,
      company_id,
    });

    const cardDeleteOptions = {
      filter: {
        _id: card_id,
        company_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      data: {
        status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
        excluded: true,
      },
    };

    await cardHandler.update(cardDeleteOptions);

    return res.status(200).json({
      message: localize("companies.cards.delete.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/credits:
 *   get:
 *     summary: Get pending credits
 *     description: Retrieve all pending credits for the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending credits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   user:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                   card:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       credits_needed:
 *                         type: number
 *                   status:
 *                     type: string
 *                     enum: [pending, available, used, rejected]
 *                   requested_at:
 *                     type: string
 *                     format: date-time
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyCredits(req, res, next) {
  try {
    const { company_id } = req.user;

    await validateCompany({
      company_id,
    });

    const creditHandlerOptions = {
      filter: {
        company_id,
        status: statusConsts.CREDITS_STATUS.PENDING,
        excluded: false,
      },
      projection: {
        _id: 1,
        user_id: 1,
        card_id: 1,
        created_at: 1,
      },
    };

    const credits = await creditHandler.list(creditHandlerOptions);

    const userIds = credits.map((credit) => credit.user_id);
    const cardIds = credits.map((credit) => credit.card_id);

    const userHandlerOptions = {
      filter: {
        _id: { $in: userIds },
      },
      projection: {
        _id: 1,
        name: 1,
        phone: 1,
      },
    };

    const users = await userHandler.list(userHandlerOptions);

    const cardHandlerOptions = {
      filter: {
        _id: { $in: cardIds },
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        _id: 1,
        title: 1,
      },
    };

    const cards = await cardHandler.list(cardHandlerOptions);

    const response = credits
      .map((credit) => ({
        ...credit,
        user: users.find((user) => user._id.toString() === credit.user_id.toString()),
        card: cards.find((card) => card._id.toString() === credit.card_id.toString()),
      }))
      .filter((credit) => credit.card);

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/credits/{credit_id}:
 *   patch:
 *     summary: Update credit status
 *     description: Approve or reject a pending credit request
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: credit_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [available, rejected]
 *                 description: New status for the credit
 *                 example: "available"
 *     responses:
 *       200:
 *         description: Credit status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Credit status updated successfully"
 *                 credit:
 *                   $ref: '#/components/schemas/Credit'
 *       400:
 *         description: Invalid status or credit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Credit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateCompanyCredit(req, res, next) {
  try {
    const { company_id } = req.user;
    const { credit_id } = req.params;
    const { status } = req.body;

    await validateCompany({
      company_id,
    });

    const credit = await validateCredit({
      credit_id,
      company_id,
      projection: {
        _id: 1,
        card_id: 1,
      },
    });

    await validateCard({
      card_id: credit.card_id,
      company_id,
    });

    if (status !== statusConsts.CREDITS_STATUS.AVAILABLE && status !== statusConsts.CREDITS_STATUS.REJECTED) {
      throw new ValidationError({
        message: localize("error.generic.invalid", { field: "status" }),
      });
    }

    const creditUpdateOptions = {
      filter: {
        _id: credit_id,
      },
      data: {
        status,
      },
    };

    await creditHandler.update(creditUpdateOptions);

    return res.status(200).json({
      message: localize("companies.credits.update.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/users:
 *   get:
 *     summary: Get company users
 *     description: Retrieve all users (clients) associated with the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of results to return
 *         example: 20
 *       - in: query
 *         name: skip
 *         schema:
 *           type: number
 *         description: Number of results to skip
 *         example: 0
 *     responses:
 *       200:
 *         description: Company users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyUsers(req, res, next) {
  try {
    const { company_id } = req.user;
    let { limit, skip } = req.query;

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    if (!limit) {
      limit = process.env.PAGINATION_DEFAULT_LIMIT;
    }

    if (!skip) {
      skip = 0;
    }

    const userHandlerOptions = {
      filter: {
        company_id,
        role: roleConstants.USER_ROLES.CLIENT,
        excluded: false,
      },
      limit,
      skip,
      sort: {
        status: 1,
        name: 1,
      },
      projection: {
        name: 1,
        status: 1,
      },
    };

    const users = await userHandler.list(userHandlerOptions);

    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/users/{user_id}:
 *   get:
 *     summary: Get company user by ID
 *     description: Retrieve detailed information about a specific user (client)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyUserById(req, res, next) {
  try {
    const { company_id } = req.user;
    const { user_id } = req.params;

    if (!company_id) {
      throw new ForbiddenError();
    }

    await validateCompany({
      company_id,
    });

    const userReadOptions = {
      filter: {
        _id: user_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        role: roleConstants.USER_ROLES.CLIENT,
        excluded: false,
      },
      projection: {
        name: 1,
        phone: 1,
        created_at: 1,
        status: 1,
      },
    };

    const user = await userHandler.read(userReadOptions);

    if (!user) {
      throw new NotFoundError({
        message: localize("error.generic.notFound", { resource: localize("resources.user") }),
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/users/{user_id}:
 *   patch:
 *     summary: Update company user
 *     description: Update user (client) information
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User name
 *                 example: "João Silva"
 *               phone:
 *                 type: string
 *                 description: User phone number
 *                 example: "5511999999999"
 *               password:
 *                 type: string
 *                 description: User password
 *                 example: "newPassword123"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User updated successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function updateCompanyUser(req, res, next) {
  try {
    const { company_id } = req.user;
    const { user_id } = req.params;
    const { name, phone, password } = req.body;

    if (!name && !phone && !password) {
      throw new ValidationError();
    }

    await validateCompany({
      company_id,
    });

    await validateUser({
      user_id,
      company_id,
    });

    const allowedFields = ["name", "phone", "password"];

    const data = allowedFields.reduce((acc, field) => {
      if (req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    const userUpdateOptions = {
      filter: {
        _id: user_id,
      },
      data,
    };

    await userHandler.update(userUpdateOptions);

    return res.status(200).json({
      message: localize("companies.users.update.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/users/{user_id}:
 *   delete:
 *     summary: Delete company user
 *     description: Delete a user (client) from the company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User deleted successfully"
 *       400:
 *         description: Cannot delete last user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function deleteCompanyUser(req, res, next) {
  try {
    const { company_id } = req.user;
    const { user_id } = req.params;

    await validateCompany({
      company_id,
    });

    await validateUser({
      user_id,
      company_id,
    });

    const userHandlerOptions = {
      filter: {
        company_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const users = await userHandler.list(userHandlerOptions);

    if (users.length === 1) {
      throw new ValidationError({
        message: localize("companies.users.delete.error.lastUser"),
      });
    }

    const userDeleteOptions = {
      filter: {
        _id: user_id,
      },
      data: {
        status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
      },
    };

    await userHandler.update(userDeleteOptions);

    return res.status(200).json({
      message: localize("companies.users.delete.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}/credits/{credit_id}:
 *   delete:
 *     summary: Delete consumer credit
 *     description: Delete a specific credit from a consumer
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *       - in: path
 *         name: credit_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit ID
 *     responses:
 *       200:
 *         description: Credit deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Credit deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Credit not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function deleteConsumerCredit(req, res, next) {
  try {
    const { company_id } = req.user;
    const { consumer_id, credit_id } = req.params;

    await validateCompany({
      company_id,
    });

    // Validate that the credit exists, belongs to the consumer and company, and is not excluded
    const creditReadOptions = {
      filter: {
        _id: credit_id,
        user_id: consumer_id,
        company_id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const credit = await creditHandler.read(creditReadOptions);

    if (!credit) {
      throw new NotFoundError({
        message: localize("error.generic.notFound", { resource: localize("resources.credit") }),
      });
    }

    const creditDeleteOptions = {
      filter: {
        _id: credit_id,
      },
      data: {
        excluded: true,
      },
    };

    await creditHandler.update(creditDeleteOptions);

    return res.status(200).json({
      message: localize("companies.consumers.deleteCredit.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}/cards/{card_id}/redeem:
 *   post:
 *     summary: Redeem card benefits
 *     description: Redeem benefits by converting available credits to used status
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *       - in: path
 *         name: card_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Card ID
 *     responses:
 *       200:
 *         description: Card benefits redeemed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Card benefits redeemed successfully"
 *                 redeemedCredits:
 *                   type: number
 *                   description: Number of credits redeemed
 *                   example: 5
 *       400:
 *         description: Insufficient credits or invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Consumer, card, or credits not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function redeemCardBenefits(req, res, next) {
  try {
    const { company_id } = req.user;
    const { consumer_id, card_id } = req.params;

    await validateCompany({
      company_id,
    });

    // Validate consumer exists and has credits from this company
    await validateConsumer({
      consumer_id,
      company_id,
    });

    // Validate card exists and belongs to the company
    const card = await validateCard({
      card_id,
      company_id,
      projection: {
        _id: 1,
        title: 1,
        credits_needed: 1,
        status: 1,
      },
    });

    // Get available credits for this consumer and card
    const availableCredits = await creditHandler.list({
      filter: {
        user_id: consumer_id,
        card_id: card_id,
        company_id: company_id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        _id: 1,
        created_at: 1,
      },
      sort: {
        created_at: 1, // Use oldest credits first (FIFO)
      },
    });

    if (availableCredits.length < card.credits_needed) {
      throw new ValidationError({
        message: localize("companies.consumers.redeem.insufficientCredits", {
          needed: card.credits_needed,
          available: availableCredits.length,
        }),
      });
    }

    // Get the exact number of credits needed (oldest first)
    const creditsToRedeem = availableCredits.slice(0, card.credits_needed);
    const creditIds = creditsToRedeem.map((credit) => credit._id);

    // Bulk update credits to USED status with requested_at timestamp
    const updateResult = await creditHandler.updateMany({
      filter: {
        _id: { $in: creditIds },
      },
      data: {
        status: statusConsts.CREDITS_STATUS.USED,
        requested_at: new Date(),
      },
    });

    if (updateResult.modifiedCount !== card.credits_needed) {
      throw new ValidationError({
        message: localize("companies.consumers.redeem.updateError"),
      });
    }

    return res.status(200).json({
      message: localize("companies.consumers.redeem.success"),
      redeemedCredits: card.credits_needed,
      cardTitle: card.title,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/consumers/{consumer_id}:
 *   delete:
 *     summary: Delete consumer
 *     description: Delete a consumer from the company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: consumer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consumer ID
 *     responses:
 *       200:
 *         description: Consumer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Consumer deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Consumer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function deleteConsumer(req, res, next) {
  try {
    const { company_id } = req.user;
    const { consumer_id } = req.params;

    await validateCompany({
      company_id,
    });

    await validateConsumer({
      consumer_id,
      company_id,
    });

    const consumerDeleteOptions = {
      filter: {
        _id: consumer_id,
      },
      data: {
        status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
        excluded: true,
      },
    };

    await userHandler.update(consumerDeleteOptions);

    return res.status(200).json({
      message: localize("companies.consumers.delete.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/users:
 *   post:
 *     summary: Create company user
 *     description: Create a new user (client) for the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 description: User name
 *                 example: "João Silva"
 *               phone:
 *                 type: string
 *                 description: User phone number
 *                 example: "5511999999999"
 *     responses:
 *       200:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User created successfully"
 *       400:
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function createCompanyUser(req, res, next) {
  try {
    const { company_id } = req.user;
    const { name, phone } = req.body;

    if (!phone) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "phone" }),
      });
    }

    await validateCompany({
      company_id,
    });

    const userCreateOptions = {
      data: {
        name,
        phone,
        company_id,
        role: roleConstants.USER_ROLES.CLIENT,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const user = await userHandler.create(userCreateOptions);

    if (user instanceof Error) {
      throw new ValidationError({
        message: user.message,
      });
    }

    return res.status(200).json({
      message: localize("companies.users.create.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/companies/stats:
 *   get:
 *     summary: Get company statistics
 *     description: Retrieve dashboard statistics for the authenticated company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recentClients:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 newClientsChart:
 *                   type: object
 *                   properties:
 *                     dataKey:
 *                       type: string
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           week:
 *                             type: string
 *                           count:
 *                             type: number
 *                     total:
 *                       type: number
 *                 creditsGivenChart:
 *                   type: object
 *                   properties:
 *                     dataKey:
 *                       type: string
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           week:
 *                             type: string
 *                           count:
 *                             type: number
 *                     total:
 *                       type: number
 *                 creditsUsedChart:
 *                   type: object
 *                   properties:
 *                     dataKey:
 *                       type: string
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           week:
 *                             type: string
 *                           count:
 *                             type: number
 *                     total:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be a client with company access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCompanyStats(req, res, next) {
  try {
    const { company_id } = req.user;

    await validateCompany({
      company_id,
    });

    // Recent Clients - Latest 5 clients that have received credits
    const recentClients = await creditHandler.aggregate({
      pipeline: getClientConsumersAggregation({
        company_id,
        limit: 5,
      }),
    });

    // New Clients - Latest clients that have received credits in the last 4 weeks
    const fourWeeksAgo = subTime(new Date(), 28, "days");
    const newClientsRaw = await creditHandler.aggregate({
      pipeline: getNewClientsAggregationLast4Weeks({
        company_id,
        baseDate: fourWeeksAgo,
      }),
    });

    // Process newClients with weekly stats
    const newClientsStats = processWeeklyStats(newClientsRaw, "user_id", "created_at");

    // Credits Given - Credits given to clients in the last 4 weeks
    const creditsGiven = await creditHandler.list({
      filter: {
        company_id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        created_at: { $gte: fourWeeksAgo },
      },
      projection: {
        created_at: 1,
      },
    });

    const creditsGivenStats = processWeeklyStats(creditsGiven);

    // Credits Used - Credits used by clients in the last 4 weeks
    const creditsUsed = await creditHandler.list({
      filter: {
        company_id,
        status: statusConsts.CREDITS_STATUS.USED,
        requested_at: { $gte: fourWeeksAgo },
      },
      projection: {
        requested_at: 1,
      },
    });

    const creditsUsedStats = processWeeklyStats(creditsUsed, null, "requested_at");

    const response = {
      recentClients: recentClients.map((client) => ({
        _id: client._id,
        name: client.name,
        phone: client.phone,
        created_at: client.created_at,
      })),
      newClientsChart: {
        dataKey: "week",
        data: newClientsStats,
        total: newClientsStats.reduce((sum, week) => sum + week.count, 0),
      },
      creditsGivenChart: {
        dataKey: "week",
        data: creditsGivenStats,
        total: creditsGivenStats.reduce((sum, week) => sum + week.count, 0),
      },
      creditsUsedChart: {
        dataKey: "week",
        data: creditsUsedStats,
        total: creditsUsedStats.reduce((sum, week) => sum + week.count, 0),
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

async function validateCredits(options) {
  if (!options.credits) {
    return;
  }

  // First validate that all credits have required fields
  for (const credit of options.credits) {
    if (!credit.card_id) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "credits.card_id" }),
      });
    }
    if (!credit.quantity) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "credits.quantity" }),
      });
    }
  }

  // Then validate that cards exist and are available
  const cardHandlerOptions = {
    filter: {
      company_id: options.company_id,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    },
  };

  const cards = await cardHandler.list(cardHandlerOptions);

  if (!cards || cards.length === 0) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.card") }),
      action: localize("companies.consumers.updateCredits.error.action"),
    });
  }

  // Finally validate that all card_ids exist in the available cards
  for (const credit of options.credits) {
    const card = cards.find((card) => card._id.toString() === credit.card_id.toString());
    if (!card) {
      throw new ForbiddenError({
        message: localize("error.generic.notFound", { resource: localize("resources.card") }),
        action: localize("companies.consumers.updateCredits.error.action"),
      });
    }
  }
}

async function validateCredit(options) {
  const creditHandlerOptions = {
    filter: {
      _id: options.credit_id,
      company_id: options.company_id,
    },
    projection: {
      _id: 1,
      status: 1,
      excluded: 1,
      card_id: 1,
    },
  };

  const credit = await creditHandler.read(creditHandlerOptions);

  if (!credit) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.credit") }),
    });
  }

  if (credit.excluded) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.credit") }),
    });
  }

  if (credit.status !== statusConsts.CREDITS_STATUS.PENDING) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.credit") }),
    });
  }

  if (options.projection) {
    return credit;
  }

  return;
}

async function validateCompany(options) {
  const companyHandlerOptions = {
    filter: {
      _id: options.company_id,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    },
  };

  if (options.projection) {
    companyHandlerOptions.projection = options.projection;
  } else {
    companyHandlerOptions.projection = {
      _id: 1,
      status: 1,
      excluded: 1,
    };
  }

  const company = await companyHandler.read(companyHandlerOptions);

  if (!company) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.company") }),
    });
  }

  if (company.excluded) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.company") }),
    });
  }

  if (company.status !== statusConsts.RESOURCE_STATUS.AVAILABLE) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.company") }),
    });
  }

  if (options.projection) {
    return company;
  }

  return;
}

async function validateCard(options) {
  const cardHandlerOptions = {
    filter: {
      _id: options.card_id,
      company_id: options.company_id,
    },
  };

  if (options.projection) {
    cardHandlerOptions.projection = options.projection;
  } else {
    cardHandlerOptions.projection = {
      _id: 1,
      status: 1,
      excluded: 1,
    };
  }

  const card = await cardHandler.read(cardHandlerOptions);

  if (!card) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.card") }),
    });
  }

  if (card.excluded) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.card") }),
    });
  }

  if (card.status !== statusConsts.RESOURCE_STATUS.AVAILABLE) {
    throw new ValidationError({
      message: localize("error.generic.notAvailable", { resource: localize("resources.card") }),
    });
  }

  if (options.projection) {
    return card;
  }

  return;
}

async function validateUser(options) {
  const userHandlerOptions = {
    filter: {
      _id: options.user_id,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
      role: roleConstants.USER_ROLES.CLIENT,
      company_id: options.company_id,
    },
  };

  const user = await userHandler.read(userHandlerOptions);

  if (!user) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.user") }),
    });
  }

  return;
}

async function validateConsumer(options) {
  const consumerReadOptions = {
    filter: {
      _id: options.consumer_id,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
      role: roleConstants.USER_ROLES.CONSUMER,
    },
  };

  const consumer = await userHandler.read(consumerReadOptions);

  if (!consumer) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.consumer") }),
    });
  }

  // Check if consumer has credits from the company
  const creditHandlerOptions = {
    filter: {
      user_id: consumer._id,
      company_id: options.company_id,
      excluded: false,
    },
  };

  const credits = await creditHandler.list(creditHandlerOptions);

  if (!credits || credits.length === 0) {
    throw new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.consumer") }),
    });
  }

  return consumer;
}

module.exports = {
  getCompanyCards,
  getCompanyCardById,
  exploreCompanies,
  getCompanyProfile,
  updateCompanyProfile,
  getConsumers,
  getConsumerById,
  createConsumer,
  updateConsumer,
  updateConsumerCredits,
  deleteConsumerCredit,
  redeemCardBenefits,
  deleteConsumer,
  createCompanyCard,
  updateCompanyCard,
  deleteCompanyCard,
  getCompanyCredits,
  updateCompanyCredit,
  getCompanyUsers,
  getCompanyUserById,
  updateCompanyUser,
  deleteCompanyUser,
  createCompanyUser,
  getCompanyStats,
};
