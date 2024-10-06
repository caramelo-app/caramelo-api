const mongoose = require("mongoose");

// Consts
const roleConsts = require("../constants/roles.constants");
const statusConsts = require("../constants/status.constants");

// Models
const UserCreditModel = require("../models/user-credit.model");
const CompanyCardModel = require("../models/company-card.model");

// Handlers
const CommonHandler = require("../handlers/common.handler");

// Aggregations
const { readUserCreditFullData, listUserCreditFullData } = require("../aggregations/user-credit.agg");

var methods = {};

/**
 * Lists user credits based on the role of the requester. Clients can list credits associated with their company,
 * and consumers can only list their own credits. The method filters out excluded credits and those not marked as available.
 * 
 * @param {Object} req - The HTTP request object containing user role and other identifiers.
 * @param {Object} res - The HTTP response object for sending back the credit data or errors.
 */
methods.list = async function (req, res) {

    let filter = {};
    filter.excluded = false;

    switch (req.user.role) {

        // Clients can only list their own user credits by cards
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            if (req.query.user_id) {
                filter.user = new mongoose.Types.ObjectId(req.query.user_id);
            }

            break;

        // Consumers can only list their own credits
        case roleConsts.USER_ROLES.CONSUMER:

            if (req.user._id) {
                filter.user = new mongoose.Types.ObjectId(req.user._id);
            }

            break;
    }

    const options = listUserCreditFullData({ filter: filter });

    CommonHandler.aggregate(options, UserCreditModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(items);
    });
};

/**
 * Retrieves detailed information for a single user credit based on its ID. Security measures ensure that
 * consumers can only access their own credit data, and clients can only access credits of users within their own company.
 * 
 * @param {Object} req - The HTTP request object containing parameters for credit identification.
 * @param {Object} res - The HTTP response object for sending back the credit data or errors.
 */
methods.read = async function (req, res) {

    let filter = {};
    filter.excluded = false;

    try {
        filter._id = new mongoose.Types.ObjectId(req.params.id);
    }
    catch (error) {
        return res.status(400).json({
            message: res.__("general.errors.bsonerror", { field: "_id" })
        });
    }

    switch (req.user.role) {

        // Consumers can only read their own user credits
        case roleConsts.USER_ROLES.CONSUMER:

            if (req.user._id) {
                filter.user = new mongoose.Types.ObjectId(req.user._id);
            }

            break;

        // Clients can only read their own user credits by cards
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;
    }

    const options = readUserCreditFullData({ filter: filter });

    CommonHandler.aggregate(options, UserCreditModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (items.length === 0) {
            return res.status(400).json({
                message: res.__("general.errors.item_not_found")
            });
        }

        return res.status(200).json(items);
    });
};

/**
 * Allows creating a new user credit. Consumers can create credits from the app to be approved later
 * Clients can create credits only for users within their own company, ensuring that the credit's company ID matches their company ID.
 * 
 * @param {Object} req - The HTTP request object containing new credit data.
 * @param {Object} res - The HTTP response object for returning the newly created credit data or errors.
 */
methods.create = async function (req, res) {

    try {

        // If count is not provided, default to 1
        const count = req.body.count || 1;

        // Array to hold the created records
        const createdItems = [];

        // We need to read the card data to get the expiration date
        const card = await new Promise((resolve, reject) => {
            CommonHandler.read({ _id: req.body.card }, CompanyCardModel, (err, item) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(item);
                }
            });
        });

        for (let i = 0; i < count; i++) {

            switch (req.user.role) {

                // Clients can create credits by their own cards
                case roleConsts.USER_ROLES.CLIENT:
                    if (req.user.company_id) {
                        req.body.company = new mongoose.Types.ObjectId(req.user.company_id);
                    }
                    break;
            }

            const options = {
                data: req.body
            };

            // Set the expiration date
            // The card expiration object (credit_expires_at) contains a ref number, and the ref_type (day, month, year)
            options.data.expires_at = new Date();
            switch (card.credit_expires_at.ref_type) {
                case "day":
                    options.data.expires_at.setDate(options.data.expires_at.getDate() + card.credit_expires_at.ref_number);
                    break;
                case "month":
                    options.data.expires_at.setMonth(options.data.expires_at.getMonth() + card.credit_expires_at.ref_number);
                    break;
                case "year":
                    options.data.expires_at.setFullYear(options.data.expires_at.getFullYear() + card.credit_expires_at.ref_number);
                    break;
            }

            // Create the record and push it to createdItems array
            const createdItem = await new Promise((resolve, reject) => {
                CommonHandler.create(options, UserCreditModel, (err, item) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(item);
                    }
                });
            });

            createdItems.push(createdItem);
        }

        // Return all created items
        return res.status(200).json(createdItems);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};

/**
 * Updates user credit data based on the credit's ID and the role of the requester.
 * Clients can only edit credits of users within their own company and are not allowed to edit credits of other companies.
 * Consumers are not permitted to edit any user credits.
 * 
 * @param {Object} req - The HTTP request object containing updates for the credit.
 * @param {Object} res - The HTTP response object for returning the updated credit data or errors.
 */
methods.update = async function (req, res) {

    let filter = {
        _id: req.params.id
    };

    switch (req.user.role) {

        // Clients can only update their own user credits by cards
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;

        // Consumers cant edit any credit
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = {
        filter: filter,
        data: req.body
    };

    await CommonHandler.update(options, UserCreditModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!item) {
            return res.status(400).json({
                message: res.__("general.errors.item_not_found")
            });
        }

        return res.status(200).json(item);
    });
};

/**
 * Deletes a user credit by setting its 'excluded' status to true. Only roles with sufficient permissions can delete credits,
 * and clients can only delete credits of users within their own company. The actual database records are not removed; they are simply marked as excluded.
 * 
 * @param {Object} req - The HTTP request object containing the ID of the credit to delete.
 * @param {Object} res - The HTTP response object for confirming deletion or returning errors.
 */
methods.delete = async function (req, res) {

    const options = {
        filter: {
            _id: req.params.id,
            excluded: false
        },
        data: {
            excluded: true
        }
    };

    switch (req.user.role) {

        // Clients can only delete their own user credits by cards
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                options.filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;

        // Consumers can't delete any credit
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    await CommonHandler.update(options, UserCreditModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!item) {
            return res.status(400).json({
                message: res.__("general.errors.item_not_found")
            });
        }

        return res.status(204).end();
    });
};

/**
 * Updates user credit data based on the card credit's ID and the user id to the USED status + the requested_at date.
 * Clients can only edit credits of users within their own company and are not allowed to edit credits of other companies.
 * Consumers are not permitted to edit any user credits.
 * Admins can release any credit.
 * 
 * @param {Object} req - The HTTP request object containing updates for the credit.
 * @param {Object} res - The HTTP response object for returning the updated credit data or errors.
 */
methods.release = async function (req, res) {

    // We need to check if the user id and the card are being passed
    if (!req.body.user || !req.body.card) {

        // add the missing parameters to the message
        let missingParameters = [];

        if (!req.body.user_id) {
            missingParameters.push("user");
        }

        if (!req.body.card_id) {
            missingParameters.push("card");
        }

        return res.status(400).json({
            message: res.__("general.errors.missing_parameters", { field: missingParameters.join(", ") })
        });
    }

    let filter = {
        user: req.body.user,
        card: req.body.card,
    };

    switch (req.user.role) {

        // Clients can only update their own user credits by cards
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;

        // Consumers cant edit any credit
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    // First we need to get how many credits we use to update the status
    // For this we need to use the card_id, and get the "credits" field, 
    // and check if they are expired (list user credits and match the card.credit_expires_at).
    // The card must be status: available and excluded: false
    // We need to read the card data to get the expiration date
    const card = await new Promise((resolve, reject) => {

        let companyCardOptions = {
            filter: {
                _id: req.body.card,
                status: statusConsts.RESOURCE_STATUS.AVAILABLE,
                excluded: false,
            },
            projection: {
                credits: 1,
                credit_expires_at: 1
            }
        }

        CommonHandler.read(companyCardOptions, CompanyCardModel, (err, item) => {
            if (err) {
                reject(err);
            } else {
                resolve(item);
            }
        });
    });

    if (!card) {
        return res.status(400).json({
            message: res.__("general.errors.item_not_found")
        });
    }

    // Double check if the user has credits available
    let userCreditOptions = {
        filter: {
            user: req.body.user,
            card: req.body.card,
            status: statusConsts.CREDITS_STATUS.AVAILABLE,
            excluded: false,
        }
    }

    const userCredits = await new Promise((resolve, reject) => {
        CommonHandler.list(userCreditOptions, UserCreditModel, (err, items) => {
            if (err) {
                reject(err);
            } else {
                resolve(items);
            }
        });
    });

    if (userCredits.length === 0) {
        return res.status(400).json({
            message: res.__("controllers.user_credits.release.not_enough_credits")
        });
    }

    // Get the credits to update based on the card.credits (credits needed) and the userCredits.length that are not expired and available
    // It need to return only the necessary credits to update, we dont need to update all the credits
    let creditsToUpdate = userCredits.filter(credit => credit.expires_at > new Date());
    creditsToUpdate = creditsToUpdate.slice(0, card.credits); // take only the necessary credits

    if (creditsToUpdate.length === 0) {
        return res.status(400).json({
            message: res.__("controllers.user_credits.release.not_enough_credits")
        });
    }

    if (creditsToUpdate.length < card.credits) {
        return res.status(400).json({
            message: res.__("controllers.user_credits.release.not_enough_credits")
        });
    }

    // we need to add the creditsToUpdate to the filters
    filter._id = { $in: creditsToUpdate.map(credit => credit._id) };

    // Update the credits
    const options = {
        filter: filter,
        data: {
            status: statusConsts.CREDITS_STATUS.USED,
            requested_at: new Date()
        }
    };

    await CommonHandler.update(options, UserCreditModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!item) {
            return res.status(400).json({
                message: res.__("general.errors.item_not_found")
            });
        }

        return res.status(200).json(item);
    });

};

module.exports = methods;