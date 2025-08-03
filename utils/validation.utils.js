const { validationResult } = require("express-validator");

const { ValidationError } = require("../infra/errors");

function validateDocument(v) {
  const regex = /^[0-9]{11}$|^[0-9]{14}$/;
  return regex.test(v);
}

function validatePhone(v) {
  const regex = /^[0-9]{13}$/;
  return regex.test(v);
}

const validateRouteRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ValidationError({
        message: errors.array()[0].msg,
      }),
    );
  }
  next();
};

module.exports = {
  validateDocument,
  validatePhone,
  validateRouteRequest,
};
