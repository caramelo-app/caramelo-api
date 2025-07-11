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

async function getCompaniesCards(req, res, next) {
  try {
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

async function requestCard(req, res, next) {
  try {
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
        email: 1,
        phone: 1,
      },
    };

    const user = await userHandler.read(userHandlerOptions);

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name && !email && !phone && !password) {
      throw new ValidationError();
    }

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

    const allowedFields = ["name", "email", "phone", "password"];

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
