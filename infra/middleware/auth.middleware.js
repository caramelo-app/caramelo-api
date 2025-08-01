const jwt = require("jsonwebtoken");

const companyModel = require("../../models/company.model");
const dbHandler = require("../../utils/db-handler.utils");
const statusConsts = require("../../constants/status.constants");
const roleConstants = require("../../constants/roles.constants");

const { localize } = require("../../utils/localization.utils");
const { UnauthorizedError, ForbiddenError } = require("../errors");

const companyHandler = dbHandler(companyModel);

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    if (!token) {
      throw new UnauthorizedError({
        message: localize("error.generic.notFound", { resource: "Token" }),
        action: localize("error.UnauthorizedError.tokenNotFound"),
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        throw new UnauthorizedError({
          message: localize("error.generic.invalid", { field: "token" }),
        });
      }

      req.user = {
        _id: decoded._id,
        role: decoded.role,
      };

      if (decoded.role === roleConstants.USER_ROLES.CLIENT) {
        req.user.company_id = decoded.company_id;
      }

      return next();
    });
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);

    if (!req.user) {
      return next(
        new UnauthorizedError({
          message: localize("error.UnauthorizedError.message"),
        }),
      );
    }

    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(
      new UnauthorizedError({
        message: localize("error.UnauthorizedError.message"),
      }),
    );
  }

  if (req.user.role !== roleConstants.USER_ROLES.ADMIN) {
    return next(
      new ForbiddenError({
        message: localize("error.ForbiddenError.message"),
      }),
    );
  }

  next();
}

function requireClient(req, res, next) {
  if (!req.user) {
    return next(
      new UnauthorizedError({
        message: localize("error.UnauthorizedError.message"),
      }),
    );
  }

  if (req.user.role !== roleConstants.USER_ROLES.CLIENT) {
    return next(
      new ForbiddenError({
        message: localize("error.ForbiddenError.message"),
      }),
    );
  }

  next();
}

function requireConsumer(req, res, next) {
  if (!req.user) {
    return next(
      new UnauthorizedError({
        message: localize("error.UnauthorizedError.message"),
      }),
    );
  }

  if (req.user.role !== roleConstants.USER_ROLES.CONSUMER) {
    return next(
      new ForbiddenError({
        message: localize("error.ForbiddenError.message"),
      }),
    );
  }

  next();
}

async function requireCompanyAccess(req, res, next) {
  try {
    if (!req.user) {
      return next(
        new UnauthorizedError({
          message: localize("error.UnauthorizedError.message"),
        }),
      );
    }

    if (req.user.role !== roleConstants.USER_ROLES.CLIENT) {
      return next(
        new ForbiddenError({
          message: localize("error.ForbiddenError.message"),
        }),
      );
    }

    if (!req.user.company_id) {
      return next(
        new ForbiddenError({
          message: localize("error.generic.notFound", {
            resource: localize("resources.company"),
          }),
        }),
      );
    }

    const companyHandlerOptions = {
      filter: {
        _id: req.user.company_id,
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
    };

    const company = await companyHandler.read(companyHandlerOptions);

    if (!company) {
      return next(
        new UnauthorizedError({
          message: localize("error.generic.notAvailable", {
            resource: localize("resources.company"),
          }),
        }),
      );
    }

    req.company = company;

    next();
  } catch (error) {
    next(error);
  }
}

function requireGuest(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      return next(
        new ForbiddenError({
          message: "Você já está autenticado",
        }),
      );
    }

    next();
  });
}

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  requireClient,
  requireConsumer,
  requireCompanyAccess,
  requireGuest,
};
