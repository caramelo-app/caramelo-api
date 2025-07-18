const { localize } = require("../utils/localization.utils");
const { ServiceError, ValidationError, InternalServerError } = require("../infra/errors");

module.exports = function (model) {
  const methods = {};

  methods.list = async (options) => {
    const filter = options?.filter || {};
    const sort = options?.sort || {};
    const projection = options?.projection || {};
    const limit = options?.limit || 1000;
    const skip = options?.skip || 0;

    try {
      const result = await model.find(filter, projection).sort(sort).limit(limit).skip(skip).lean();
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.list.message"));
    }
  };

  methods.read = async (options) => {
    if (!options?.filter) {
      return new ServiceError({
        message: localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      });
    }

    const filter = options.filter;
    const projection = options.projection || {};

    try {
      const result = await model.findOne(filter, projection).lean();
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.read.message"));
    }
  };

  methods.create = async (options) => {
    const data = new model(options.data);

    try {
      const result = await data.save();
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.create.message"));
    }
  };

  methods.update = async (options) => {
    if (!options?.filter) {
      return new ServiceError({
        message: localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      });
    }
    const filter = options.filter;
    const data = options?.data || {};

    try {
      const result = await model
        .findOneAndUpdate(filter, data, {
          new: true,
          runValidators: true,
          timestamps: true,
        })
        .lean();
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.update.message"));
    }
  };

  methods.remove = async (options) => {
    if (!options?.filter) {
      return new ServiceError({
        message: localize("error.generic.notFound", {
          resource: "options.filter",
        }),
      });
    }

    const filter = options.filter;

    try {
      const result = await model.deleteMany(filter);
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.remove.message"));
    }
  };

  methods.aggregate = async (options) => {
    try {
      const result = await model.aggregate(options.pipeline);
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.aggregate.message"));
    }
  };

  methods.createMany = async (options) => {
    if (!options?.data || !Array.isArray(options.data)) {
      return new ServiceError({
        message: localize("error.generic.notFound", {
          resource: "options.data (array)",
        }),
      });
    }

    try {
      const result = await model.insertMany(options.data, {
        ordered: options.ordered !== false, // default true
        rawResult: false,
      });
      return result;
    } catch (error) {
      return handleError(error, localize("error.dbHandler.createMany.message"));
    }
  };

  methods.getModelName = () => {
    return model.modelName;
  };

  function handleError(error, message) {
    switch (error.name) {
      case "ValidationError":
        return new ValidationError({
          cause: error,
          message,
        });
      case "MongoServerError":
        return new InternalServerError({
          cause: error,
          message,
        });
      default:
        return new ServiceError({
          cause: error,
          message,
        });
    }
  }

  return methods;
};
