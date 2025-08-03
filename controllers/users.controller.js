const dateUtils = require("../utils/date.utils");
const userModel = require("../models/user.model");
const cardModel = require("../models/card.model");
const creditModel = require("../models/credit.model");
const dbHandler = require("../utils/db-handler.utils");
const companyModel = require("../models/company.model");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");

const { ValidationError } = require("../infra/errors");
const { localize } = require("../utils/localization.utils");

const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const companyHandler = dbHandler(companyModel);

// Validation functions
function validateCompanyId(companyId) {
  if (!companyId) {
    throw new ValidationError({
      message: localize("error.generic.required", { field: "company_id" }),
    });
  }

  return true;
}

function validateCardId(cardId) {
  if (!cardId) {
    throw new ValidationError({
      message: localize("error.generic.required", { field: "card_id" }),
    });
  }

  return true;
}

function validatePhone(phone) {
  if (phone) {
    const phoneRegex = /^[0-9]{13}$/;
    if (!phoneRegex.test(phone)) {
      throw new ValidationError({
        message: localize("error.generic.invalidFormat", { field: "phone" }),
      });
    }
  }

  return true;
}

function validateName(name) {
  if (name && name.length < 1) {
    throw new ValidationError({
      message: localize("error.generic.invalidFormat", { field: "name" }),
    });
  }

  return true;
}

function validatePassword(password) {
  if (password && password.length < 3) {
    throw new ValidationError({
      message: localize("error.generic.invalidFormat", { field: "password" }),
    });
  }

  return true;
}

/**
 * @swagger
 * /v1/users/cards:
 *   get:
 *     summary: Get user cards
 *     description: Retrieve all cards available to the authenticated consumer
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User cards retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   company:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       segment:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                       logo:
 *                         type: string
 *                       address:
 *                         type: object
 *                         properties:
 *                           street:
 *                             type: string
 *                           number:
 *                             type: number
 *                           complement:
 *                             type: string
 *                           neighborhood:
 *                             type: string
 *                           city:
 *                             type: string
 *                           state:
 *                             type: string
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
async function getCards(req, res, next) {
  let response = [];

  try {
    const creditHandlerOptions = {
      filter: {
        user_id: req.user._id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        company_id: 1,
      },
    };

    const credits = await creditHandler.list(creditHandlerOptions);

    const companyIds = credits.map((credit) => credit.company_id);

    const companyHandlerOptions = {
      filter: {
        _id: { $in: companyIds },
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
      projection: {
        name: 1,
        "segment.name": 1,
        logo: 1,
        address: 1,
      },
    };

    const companies = await companyHandler.list(companyHandlerOptions);

    for (const credit of credits) {
      const company = companies.find((company) => company._id.equals(credit.company_id));

      if (!company) {
        continue;
      }

      response.push({
        company: {
          name: company.name,
          segment: {
            name: company.segment.name,
          },
          logo: company.logo,
          address: {
            street: company.address.street,
            number: company.address.number,
            complement: company.address.complement,
            neighborhood: company.address.neighborhood,
            city: company.address.city,
            state: company.address.state,
          },
        },
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/users/cards/companies/{company_id}/list:
 *   get:
 *     summary: Get company cards for user
 *     description: Retrieve all cards from a specific company available to the authenticated consumer
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: company_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
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
 *       400:
 *         description: Invalid company ID
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
async function getCompaniesCards(req, res, next) {
  try {
    // Validate input
    validateCompanyId(req.params.company_id);
    let cards = [];

    const companyHandlerOptions = {
      filter: {
        _id: req.params.company_id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
    };

    const company = await companyHandler.list(companyHandlerOptions);

    if (!company || company.length === 0) {
      throw new ValidationError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.company") }),
      });
    }

    const cardsHandlerOptions = {
      filter: {
        company_id: req.params.company_id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
      projection: {
        title: 1,
      },
    };

    const cardResponse = await cardHandler.list(cardsHandlerOptions);

    if (cardResponse) {
      cards = cardResponse;
    }

    return res.status(200).json(cards);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/users/cards/{card_id}/request:
 *   post:
 *     summary: Request credit for a card
 *     description: Request a credit for a specific card from a company
 *     tags: [Users]
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
 *         description: Credit requested successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Credit requested successfully"
 *                 credit:
 *                   $ref: '#/components/schemas/Credit'
 *       400:
 *         description: Invalid request or card not found
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
 *       404:
 *         description: Card not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function requestCard(req, res, next) {
  try {
    // Validate input
    validateCardId(req.params.card_id);
    const cardHandlerOptions = {
      filter: {
        _id: req.params.card_id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
      projection: {
        company_id: 1,
        credit_expires_at: 1,
      },
    };

    const card = await cardHandler.list(cardHandlerOptions);

    if (!card || card.length === 0) {
      throw new ValidationError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.card") }),
      });
    }

    const companyHandlerOptions = {
      filter: {
        _id: card[0].company_id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
    };

    const company = await companyHandler.list(companyHandlerOptions);

    if (!company || company.length === 0) {
      throw new ValidationError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.company") }),
      });
    }

    const creditHandlerData = {
      data: {
        user_id: req.user._id,
        card_id: req.params.card_id,
        company_id: card[0].company_id,
        status: statusConsts.CREDITS_STATUS.PENDING,
        expires_at: dateUtils.addTime(
          new Date(),
          card[0].credit_expires_at.ref_number,
          card[0].credit_expires_at.ref_type,
        ),
      },
    };

    await creditHandler.create(creditHandlerData);

    return res.status(200).json({ message: localize("users.cards.request.success") });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve the authenticated user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getProfile(req, res, next) {
  try {
    const userHandlerOptions = {
      filter: {
        _id: req.user._id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
      projection: {
        name: 1,
        phone: 1,
      },
    };

    const user = await userHandler.read(userHandlerOptions);

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/users/profile:
 *   patch:
 *     summary: Update user profile
 *     description: Update the authenticated user's profile information
 *     tags: [Users]
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
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User profile updated successfully"
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
 */
async function updateProfile(req, res, next) {
  try {
    const { name, phone, password } = req.body;

    if (!name && !phone && !password) {
      throw new ValidationError();
    }

    // Validate input fields if provided
    if (name) validateName(name);
    if (phone) validatePhone(phone);
    if (password) validatePassword(password);

    const userHandlerOptions = {
      filter: {
        _id: req.user._id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
    };

    const user = await userHandler.read(userHandlerOptions);

    if (!user) {
      throw new ValidationError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.user") }),
      });
    }

    const allowedFields = ["name", "phone", "password"];

    const data = allowedFields.reduce((acc, field) => {
      if (req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    await userHandler.update({
      filter: {
        _id: user._id,
      },
      data,
    });

    return res.status(200).json({
      message: localize("users.profile.update.success"),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/users/profile:
 *   delete:
 *     summary: Cancel user account
 *     description: Cancel the authenticated user's account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Account cancelled successfully"
 *       400:
 *         description: Invalid request
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
 */
async function cancelAccount(req, res, next) {
  try {
    const userHandlerOptions = {
      filter: {
        _id: req.user._id,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
    };

    const user = await userHandler.read(userHandlerOptions);

    if (!user) {
      throw new ValidationError({
        message: localize("error.generic.notAvailable", { resource: localize("resources.user") }),
      });
    }

    if (req.user.role === roleConstants.USER_ROLES.CLIENT) {
      if (!req.user.company_id) {
        throw new ValidationError({
          message: localize("error.generic.notFound", { resource: localize("resources.company") }),
        });
      }

      if (user.company_id && user.company_id.toString() !== req.user.company_id.toString()) {
        throw new ValidationError({
          message: localize("error.generic.notAvailable", { resource: localize("resources.user") }),
        });
      }
    }

    await userHandler.update({
      filter: {
        _id: user._id,
      },
      data: {
        excluded: true,
        status: statusConsts.RESOURCE_STATUS.UNAVAILABLE,
      },
    });

    return res.status(200).json({
      message: localize("users.profile.cancel.success"),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCards,
  getCompaniesCards,
  requestCard,
  getProfile,
  updateProfile,
  cancelAccount,
};
