const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Buffer } = require("buffer");

const userModel = require("../models/user.model");
const smsService = require("../services/sms.service");
const dbHandler = require("../utils/db-handler.utils");
const companyModel = require("../models/company.model");
const passwordUtils = require("../utils/password.utils");
const smsTemplates = require("../templates/sms.templates");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");

const { addTime } = require("../utils/date.utils");
const { generateToken, isTokenExpired } = require("../utils/token.utils");
const { localize } = require("../utils/localization.utils");
const { UnauthorizedError, ServiceError, ValidationError } = require("../infra/errors");

const userHandler = dbHandler(userModel);
const companyHandler = dbHandler(companyModel);

async function login(req, res, next) {
  const { phone, password } = req.body;

  try {
    const userOptions = {
      filter: {
        phone,
        excluded: false,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      },
      projection: { _id: 1, password: 1, role: 1, company_id: 1, name: 1, phone: 1 },
    };

    const user = await userHandler.read(userOptions);

    if (!user) {
      throw new UnauthorizedError({
        message: localize("error.generic.notFound", { resource: localize("resources.user") }),
      });
    }

    const isPasswordValid = await passwordUtils.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError({ message: localize("error.generic.invalid", { field: "password" }) });
    }

    const encode = {
      _id: user._id,
      role: user.role,
    };

    if (user.role === roleConstants.USER_ROLES.CLIENT) {
      encode.company_id = user.company_id;

      const companyHandlerOptions = {
        filter: {
          _id: user.company_id,
          status: statusConsts.RESOURCE_STATUS.AVAILABLE,
          excluded: false,
        },
      };

      const companyCheck = await companyHandler.read(companyHandlerOptions);

      if (!companyCheck) {
        throw new UnauthorizedError({
          message: localize("error.generic.notAvailable", { resource: localize("resources.company") }),
        });
      }
    }

    const token = jwt.sign(encode, process.env.JWT_SECRET, {
      expiresIn: process.env.LOGIN_EXPIRES_IN,
    });

    return res.status(200).json({
      tokenType: "Bearer",
      accessToken: token,
      expiresIn: parseInt(process.env.LOGIN_EXPIRES_IN),
      user: {
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function register(req, res, next) {
  const { phone, name, password } = req.body;

  try {
    const user = await userHandler.read({
      filter: { phone },
      projection: { _id: 1 },
    });

    if (user) {
      throw new ValidationError({ message: localize("error.generic.alreadyInUse", { field: "phone", value: phone }) });
    }

    // create validation token
    const validationToken = generateToken();
    const validationTokenExpiresAt = addTime(new Date(), 10, "minutes");

    await userHandler.create({
      data: {
        name,
        phone,
        password,
        status: statusConsts.RESOURCE_STATUS.PENDING,
        role: roleConstants.USER_ROLES.CONSUMER,
        validation_token: validationToken,
        validation_token_expires_at: validationTokenExpiresAt,
      },
    });

    // send sms with validation token
    const smsOptions = {
      phone,
      content: smsTemplates.sendToken(validationToken),
    };

    const { err } = await smsService.sendSms(smsOptions);

    if (err) {
      throw new ServiceError({
        message: localize("error.services.sms.message"),
        action: localize("error.services.sms.action"),
        cause: err,
      });
    }

    return res.status(200).json({
      message: localize("auth.register.success"),
    });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  const { phone } = req.body;

  try {
    const readUserOptions = {
      filter: { phone },
      projection: { _id: 1, phone: 1 },
    };
    const user = await userHandler.read(readUserOptions);

    if (!user || !user.phone) {
      throw new UnauthorizedError({
        message: localize("error.generic.notFound", { resource: localize("resources.user") }),
        action: localize("error.generic.notFoundActionMessage", {
          resource: localize("resources.user").toLowerCase(),
        }),
      });
    }

    const token = generateToken();

    const userUpdateOptions = {
      filter: { _id: user._id },
      data: {
        validation_token: token,
        validation_token_expires_at: addTime(new Date(), 10, "minutes"),
      },
    };

    await userHandler.update(userUpdateOptions);

    const smsOptions = {
      phone: user.phone,
      content: smsTemplates.sendToken(token),
    };

    const { err } = await smsService.sendSms(smsOptions);

    if (err) {
      throw new ServiceError({
        message: localize("error.services.sms.message"),
        action: localize("error.services.sms.action"),
        cause: err,
      });
    }

    return res.status(200).json({
      message: localize("auth.forgotPassword.success"),
    });
  } catch (error) {
    next(error);
  }
}

async function validateResetToken(req, res, next) {
  try {
    const { token, phone } = req.body;

    const user = await searchForUser(phone);
    validateTokenEntries(user, token);

    const userUpdateOptions = {
      filter: { phone },
      data: { validation_token: null, validation_token_expires_at: null },
    };

    await userHandler.update(userUpdateOptions);

    return res.status(200).json({
      message: localize("auth.validateResetToken.success"),
    });
  } catch (error) {
    next(error);
  }
}

async function validateRegisterToken(req, res, next) {
  const { token, phone } = req.body;

  try {
    const user = await searchForUser(phone, statusConsts.RESOURCE_STATUS.PENDING, false);
    validateTokenEntries(user, token);

    const userUpdateOptions = {
      filter: { phone },
      data: {
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        validation_token: null,
        validation_token_expires_at: null,
      },
    };

    await userHandler.update(userUpdateOptions);

    return res.status(200).json({
      message: localize("auth.validateRegisterToken.success"),
    });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  const { phone, password, token } = req.body;

  try {
    const user = await searchForUser(phone);
    validateTokenEntries(user, token);

    const userUpdateOptions = {
      filter: { phone },
      data: { password },
    };

    await userHandler.update(userUpdateOptions);

    return res.status(200).json({
      message: localize("auth.resetPassword.success"),
    });
  } catch (error) {
    next(error);
  }
}

async function searchForUser(phone, status = statusConsts.RESOURCE_STATUS.AVAILABLE, excluded = false) {
  const readUserOptions = {
    filter: { phone, excluded, status },
    projection: { _id: 1, phone: 1, validation_token: 1, validation_token_expires_at: 1 },
  };

  const user = await userHandler.read(readUserOptions);

  if (!user || !user.phone) {
    throw new UnauthorizedError({
      message: localize("error.generic.notFound", { resource: localize("resources.user") }),
      action: localize("error.generic.notFoundActionMessage", {
        resource: localize("resources.user").toLowerCase(),
      }),
    });
  }

  return user;
}

function validateTokenEntries(user, token) {
  if (!user) {
    throw new UnauthorizedError({
      message: localize("error.generic.notFound", { resource: localize("resources.user") }),
    });
  }

  if (!user.validation_token) {
    throw new UnauthorizedError({
      message: localize("error.generic.invalid", { field: "token" }),
    });
  }

  if (isTokenExpired(user.validation_token_expires_at)) {
    throw new UnauthorizedError({
      message: localize("error.auth.token.expired"),
    });
  }

  // timing-safe comparison
  if (!crypto.timingSafeEqual(Buffer.from(token.toString()), Buffer.from(user.validation_token.toString()))) {
    throw new UnauthorizedError({
      message: localize("error.generic.invalid", { field: "token" }),
    });
  }
}

module.exports = {
  login,
  forgotPassword,
  validateResetToken,
  resetPassword,
  register,
  validateRegisterToken,
};
