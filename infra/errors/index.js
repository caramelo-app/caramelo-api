const { localize } = require("../../utils/localization.utils");

class InternalServerError extends Error {
  constructor({ cause, statusCode, message } = {}) {
    super(message || localize("error.InternalServerError.message"), {
      cause,
    });
    this.name = "InternalServerError";
    this.action = localize("error.InternalServerError.action");
    this.status_code = statusCode || 500;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
    };
  }
}

class ServiceError extends Error {
  constructor({ cause, message, action } = {}) {
    super(message || localize("error.ServiceError.message"), {
      cause,
    });
    this.name = "ServiceError";
    this.action = action || localize("error.ServiceError.action");
    this.status_code = 503;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
    };
  }
}

class ValidationError extends Error {
  constructor({ message, action, cause } = {}) {
    super(message || localize("error.ValidationError.message"));
    this.name = "ValidationError";
    this.action = action || localize("error.ValidationError.action");
    this.status_code = 400;
    this.cause = cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
      cause: this.cause,
    };
  }
}

class NotFoundError extends Error {
  constructor({ message, action } = {}) {
    super(message || localize("error.NotFoundError.message"));
    this.name = "NotFoundError";
    this.action = action || localize("error.NotFoundError.action");
    this.status_code = 404;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
    };
  }
}

class UnauthorizedError extends Error {
  constructor({ message, action } = {}) {
    super(message || localize("error.UnauthorizedError.message"));
    this.name = "UnauthorizedError";
    this.action = action || localize("error.UnauthorizedError.action");
    this.status_code = 401;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
    };
  }
}

class ForbiddenError extends Error {
  constructor({ message, action } = {}) {
    super(message || localize("error.ForbiddenError.message"));
    this.name = "ForbiddenError";
    this.action = action || localize("error.ForbiddenError.action");
    this.status_code = 403;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.status_code,
    };
  }
}

module.exports = {
  InternalServerError,
  ServiceError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
};
