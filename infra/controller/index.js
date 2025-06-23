const {
  InternalServerError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ServiceError,
  ForbiddenError,
} = require("../errors");

function onNoMatchHandler(req, res, _next) {
  const publicErrorObject = new NotFoundError({
    message: `Route ${req.originalUrl} not found`,
  });
  return res.status(publicErrorObject.status_code).json(publicErrorObject.toJSON());
}

function onErrorHandler(err, req, res, _next) {
  if (
    err instanceof ValidationError ||
    err instanceof NotFoundError ||
    err instanceof UnauthorizedError ||
    err instanceof ServiceError ||
    err instanceof ForbiddenError
  ) {
    return res.status(err.status_code).json(err.toJSON());
  }

  const publicErrorObject = new InternalServerError({
    cause: err,
  });

  console.log(err);

  return res.status(publicErrorObject.status_code).json(publicErrorObject.toJSON());
}

module.exports = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
};
