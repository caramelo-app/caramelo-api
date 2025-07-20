const dateUtils = require("../utils/date.utils");
const userModel = require("../models/user.model");
const cardModel = require("../models/card.model");
const creditModel = require("../models/credit.model");
const dbHandler = require("../utils/db-handler.utils");
const companyModel = require("../models/company.model");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");

const { subTime, processWeeklyStats } = require("../utils/date.utils");
const { localize } = require("../utils/localization.utils");
const { NotFoundError, ForbiddenError, ValidationError, UnauthorizedError } = require("../infra/errors");
const { getRecentClientsAggregation, getNewClientsAggregationLast4Weeks } = require("../aggregations/companies.aggregation");

const userHandler = dbHandler(userModel);
const cardHandler = dbHandler(cardModel);
const creditHandler = dbHandler(creditModel);
const companyHandler = dbHandler(companyModel);

async function exploreCompanies(req, res, next) {
  try {
    let { latitude, longitude, distance, limit, skip } = req.query;

    if (!distance) {
      distance = process.env.EXPLORE_DEFAULT_DISTANCE;
    } else {
      if (distance > 10) {
        distance = 10;
      }
    }

    if (!limit) {
      limit = process.env.PAGINATION_DEFAULT_LIMIT;
    }

    if (!skip) {
      skip = 0;
    }

    const companyListOptions = {
      filter: {
        "address.location.coordinates": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: distance * 1000,
          },
        },
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        name: 1,
        "segment.name": 1,
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

async function getConsumers(req, res, next) {
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

    let consumers = [];

    const creditHandlerOptions = {
      filter: {
        company_id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        user_id: 1,
      },
      limit,
      skip,
      sort: {
        name: 1,
      },
    };

    const credits = await creditHandler.list(creditHandlerOptions);

    const userIds = credits.map((credit) => credit.user_id);

    const userHandlerOptions = {
      filter: {
        _id: { $in: userIds },
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        _id: 1,
        name: 1,
        phone: 1,
      },
    };

    const users = await userHandler.list(userHandlerOptions);

    for (const user of users) {
      consumers.push({
        _id: user._id,
        name: user.name,
        phone: user.phone,
      });
    }

    return res.status(200).json(consumers);
  } catch (error) {
    next(error);
  }
}

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

async function createConsumer(req, res, next) {
  try {
    const { company_id } = req.user;
    const { name, phone, credits = [] } = req.body;

    if (!phone) {
      throw new ValidationError();
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

async function createCompanyCard(req, res, next) {
  try {
    const { company_id } = req.user;
    const { title, credits_needed, credit_expires_at } = req.body;

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
        }
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

async function getCompanyStats(req, res, next) {
  try {
    const { company_id } = req.user;

    await validateCompany({
      company_id,
    });

    // Recent Clients - Latest 5 clients that have received credits
    const recentClients = await creditHandler.aggregate({
      pipeline: getRecentClientsAggregation({
        company_id,
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
    const newClientsStats = processWeeklyStats(newClientsRaw, 'user_id', 'created_at');

    // Credits Given - Credits given to clients in the last 4 weeks
    const creditsGiven = await creditHandler.list({
      filter: {
        company_id,
        status: statusConsts.CREDITS_STATUS.AVAILABLE,
        created_at: { $gte: fourWeeksAgo }
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
        requested_at: { $gte: fourWeeksAgo }
      },
      projection: {
        requested_at: 1,
      },
    });
    
    const creditsUsedStats = processWeeklyStats(creditsUsed, null, 'requested_at');

    const response = {
      recentClients: recentClients.map(client => ({
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

  const cardHandlerOptions = {
    filter: {
      company_id: options.company_id,
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    },
  };

  const cards = await cardHandler.list(cardHandlerOptions);

  let error;

  if (!cards || cards.length === 0) {
    error = new ForbiddenError({
      message: localize("error.generic.notFound", { resource: localize("resources.card") }),
      action: localize("companies.consumers.updateCredits.error.action"),
    });
  }

  for (const credit of options.credits) {
    if (!credit.card_id || !credit.quantity) {
      if (!credit.card_id) {
        error = new ValidationError({
          message: localize("error.generic.required", { field: "credits.card_id" }),
        });
      }
      if (!credit.quantity) {
        error = new ValidationError({
          message: localize("error.generic.required", { field: "credits.quantity" }),
        });
      }

      if (cards && cards.length > 0) {
        const card = cards.find((card) => card._id.toString() === credit.card_id.toString());
        if (!card) {
          error = new ForbiddenError({
            message: localize("error.generic.notFound", { resource: localize("resources.card") }),
            action: localize("companies.consumers.updateCredits.error.action"),
          });
        }
      }
    }
  }

  if (error) {
    throw error;
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

  // Verificar se o consumer tem créditos da empresa
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
