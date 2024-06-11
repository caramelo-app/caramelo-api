var methods = {};

/**
 * Lists documents based on the provided options such as filters, sorting, and pagination.
 * It also supports population of referenced documents and lean queries for performance optimization.
 * 
 * @param {Object} options - Configuration object including filters, sorting, projection, population, and pagination settings.
 * @param {Object} model - The Mongoose model to execute the query on.
 * @param {Function} callback - Callback function to handle the response or error.
 */
methods.list = async function (options, model, callback) {

    let collation = options.collation || {};
    let sort = options.sort || {};
    let offset = options.offset || 0;
    let limit = options.limit || 10000;
    let projection = options.projection || {};
    let populate = options.populate || "";

    await model.find(options.filter, projection, {
        collation: collation
    })
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .populate(populate)
        .lean()
        .then((res) => {
            return callback(null, res);
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Retrieves a single document based on the provided filter. Supports sorting and population of referenced documents.
 * If no document is found, it returns an error.
 * 
 * @param {Object} options - Configuration object including filter, sorting, projection, and population settings.
 * @param {Object} model - The Mongoose model to execute the query on.
 * @param {Function} callback - Callback function to handle the found document or error.
 */
methods.read = async function (options, model, callback) {

    let sort = options.sort || {};
    let projection = options.projection || {};
    let populate = options.populate || "";
    let collation = options.collation || {};

    await model.findOne(options.filter, projection, {
        collation: collation
    })
        .sort(sort)
        .populate(populate)
        .lean()
        .then((res) => {
            if (res) {
                return callback(null, res);
            }
            else {
                return callback({ message: res.__("common.read.errors.item_not_found") }, null);
            }
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Creates a new document in the database based on the data provided. Returns the created document or an error.
 * 
 * @param {Object} options - Configuration object containing the data for the new document.
 * @param {Object} model - The Mongoose model to create the document on.
 * @param {Function} callback - Callback function to handle the created document or error.
 */
methods.create = async function (options, model, callback) {

    let item = new model(options.data);

    await item.save()
        .then((res) => {
            return callback(null, res);
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Updates an existing document based on the provided filter and update data. Supports upserting and array filters.
 * Returns the updated document or an error.
 * 
 * @param {Object} options - Configuration object including filter, update data, projection, and settings for upsert and arrayFilters.
 * @param {Object} model - The Mongoose model to update the document on.
 * @param {Function} callback - Callback function to handle the updated document or error.
 */
methods.update = async function (options, model, callback) {

    let projection = options.projection || {};
    let upsert = options.upsert || false;
    let arrayFilters = options.arrayFilters || [];
    let lean = options.lean || false;

    options.data.updated_at = new Date();

    await model.findOneAndUpdate(options.filter, options.data, {
        new: true,
        projection: projection,
        upsert: upsert,
        arrayFilters: arrayFilters,
        lean: lean,
        runValidators: true
    })
        .then((res) => {
            return callback(null, res);
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Deletes documents based on the provided filter. Returns a success message or an error.
 * 
 * @param {Object} options - Configuration object containing the filter to match documents for deletion.
 * @param {Object} model - The Mongoose model to delete documents from.
 * @param {Function} callback - Callback function to handle the deletion result or error.
 */
methods.delete = async function (options, model, callback) {

    await model.deleteMany(options.filter)
        .then((res) => {
            return callback(null, { message: res.__("general.success.item_deleted") });
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Executes an aggregation pipeline on the specified model and returns the results or an error.
 * Aggregation is used for more complex queries and transformations of the data.
 * 
 * @param {Object} options - Array containing the aggregation pipeline stages.
 * @param {Object} model - The Mongoose model to run the aggregation on.
 * @param {Function} callback - Callback function to handle the aggregation result or error.
 */
methods.aggregate = async function (options, model, callback) {

    await model.aggregate(options)
        .then((res) => {
            if (res) {
                return callback(null, res);
            }
            else {
                return callback({ message: res.__("general.errors.item_not_found") }, null);
            }
        })
        .catch((err) => {
            return callback(err, null);
        });
};

/**
 * Counts documents matching the filter criteria. Returns the count or an error.
 * This method is often used to count documents for pagination or conditional logic.
 * 
 * @param {Object} options - Configuration object containing the filter to count documents.
 * @param {Object} model - The Mongoose model to count documents on.
 * @param {Function} callback - Callback function to handle the count result or error.
 */
methods.countDocuments = async function (options, model, callback) {

    await model.countDocuments(options.filter)
        .then((res) => {
            if (res) {
                return callback(null, res);
            }
            else {
                return callback({ message: res.__("general.errors.item_not_found") }, null);
            }
        })
        .catch((err) => {
            return callback(err, null);
        });
};

module.exports = methods;