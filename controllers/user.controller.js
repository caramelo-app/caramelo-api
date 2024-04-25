const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

// Consts
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");

// Models
const UserModel = require("../models/user.model");

// Handlers
const CommonHandler = require("../handlers/common.handler");

// Aggregations
const { readUserFullData, listUserFullData } = require("../aggregations/user.agg");

var methods = {};

/**
 * Lists users based on the role of the requester. Clients can only list users within their own company,
 * and consumers are not allowed to list users at all. The method filters out excluded users and those not marked as available.
 * 
 * @param {Object} req - The HTTP request object containing user and filter criteria.
 * @param {Object} res - The HTTP response object for sending back the user data or errors.
 */
methods.list = async function (req, res) {

    let filter = {};
    filter.excluded = false;
    filter.status = statusConsts.RESOURCE_STATUS.AVAILABLE;

    switch (req.user.role) {

        // Clients can only list users for their own company
        case roleConstants.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (!filter.company) {
                    filter.company = {};
                }

                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            break;

        // Consumers can't list
        case roleConstants.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = listUserFullData({ filter: filter });

    CommonHandler.aggregate(options, UserModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(items);
    });
};

/**
 * Retrieves detailed information for a single user based on their ID. Security measures ensure that
 * consumers can only access their own data and clients can only access data of users within their own company.
 * 
 * @param {Object} req - The HTTP request object containing parameters and body for user identification.
 * @param {Object} res - The HTTP response object for sending back the user data or errors.
 */
methods.read = async function (req, res) {

    let filter = {};

    try {
        filter._id = new mongoose.Types.ObjectId(req.params.id);
    }
    catch (error) {
        return res.status(400).json({
            message: res.__("general.errors.bsonerror", { field: "_id" })
        });
    }

    if (req.body.email) {
        filter.email = req.body.email;
    }

    switch (req.user.role) {

        // Consumers can only read their own data
        case roleConstants.USER_ROLES.CONSUMER:

            if (req.user._id !== req.params.id) {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Clients can only read users from their own company
        case roleConstants.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (!filter.company) {
                    filter.company = {};
                }

                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;
    }

    const options = readUserFullData({ filter: filter });

    CommonHandler.aggregate(options, UserModel, (err, items) => {

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
 * Allows creating a new user. Clients can create users only for their company and only assign them the role of 'client'.
 * Consumers are not allowed to create users. This method also hashes the password before saving.
 * 
 * @param {Object} req - The HTTP request object containing new user data.
 * @param {Object} res - The HTTP response object for returning the newly created user data or errors.
 */
methods.create = async function (req, res) {

    switch (req.user.role) {

        // Clients can only create users for their own company
        case roleConstants.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (!req.body.company) {
                    req.body.company = {};
                }

                req.body.company = new mongoose.Types.ObjectId(req.user.company_id);
            }

            // Clients can only create users with the role of "clients"
            req.body.role = roleConstants.USER_ROLES.CLIENT;

            break;

        // Consumers can't create new users
        case roleConstants.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    };

    const options = {
        data: req.body
    };

    // We need to hash the password before saving it to the database
    if (req.body.password) {
        req.body.password = bcrypt.hashSync(req.body.password, 10);
    }

    await CommonHandler.create(options, UserModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(item);
    });
};

/**
 * Updates user data based on the user's role and company association. Clients can edit users within their own company
 * but cannot change the company or role of a user. Consumers can only update their own data.
 * This method also re-hashes the password if it is updated.
 * 
 * @param {Object} req - The HTTP request object containing user updates.
 * @param {Object} res - The HTTP response object for returning the updated user data or errors.
 */
methods.update = async function (req, res) {

    let filter = {
        _id: req.params.id
    };

    // No one can change the role of the users
    if (req.body.role) {
        delete req.body.role;
    }

    switch (req.user.role) {

        // They can only edit users from the same company
        case roleConstants.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (!filter.company) {
                    filter.company = {};
                }

                filter.company = new mongoose.Types.ObjectId(req.user.company_id);

                // Clients can't change the company by itself
                if (req.body.company) {
                    delete req.body.company;
                }
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers can only edit themselves
        case roleConstants.USER_ROLES.CONSUMER:

            if (req.user._id !== req.params.id) {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;
    }

    const options = {
        filter: filter,
        data: req.body,
        projection: {
            password: 0
        }
    };

    // We need to hash the password before saving it to the database
    if (req.body.password) {
        req.body.password = bcrypt.hashSync(req.body.password, 10);
    }

    await CommonHandler.update(options, UserModel, (err, item) => {

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
 * Deletes a user by setting their 'excluded' status to true. Clients can only delete users within their own company,
 * and consumers can only delete their own record. The actual database records are not removed; they are simply marked as excluded.
 * 
 * @param {Object} req - The HTTP request object containing the ID of the user to delete.
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

        // Clients can only delete users from the same company
        case roleConstants.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (!options.filter.company) {
                    options.filter.company = {};
                }

                options.filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers can only delete themselves
        case roleConstants.USER_ROLES.CONSUMER:

            if (req.user._id !== req.params.id) {

                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;
    }

    await CommonHandler.update(options, UserModel, (err, item) => {

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

module.exports = methods;