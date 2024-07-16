const mongoose = require("mongoose");

// Consts
const statusConsts = require("../constants/status.constants");
const roleConsts = require("../constants/roles.constants");

// Models
const CompanyCardModel = require("../models/company-card.model");

// Handlers
const CommonHandler = require("../handlers/common.handler");

// Aggregations
const { readCompanyCardFullData, listCompanyCardFullData } = require("../aggregations/company-card.agg");

var methods = {};

/**
 * Lists company cards based on the requester's role. Clients can only list cards associated with their own company.
 * Consumers are not allowed to list any company cards. The method filters out excluded cards and those not marked as available.
 * 
 * @param {Object} req - The HTTP request object containing user role and company details.
 * @param {Object} res - The HTTP response object for sending back the card data or errors.
 */
methods.list = async function (req, res) {

    let filter = {};
    filter.excluded = false;
    filter.status = statusConsts.RESOURCE_STATUS.AVAILABLE;

    switch (req.user.role) {

        // Clients can only list their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers can't list
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = listCompanyCardFullData({ filter: filter });

    CommonHandler.aggregate(options, CompanyCardModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(items);
    });
};

/**
 * Retrieves detailed information for a single company card based on its ID. Security measures ensure that
 * consumers cannot access any company card data, and clients can only access cards of their own company.
 * 
 * @param {Object} req - The HTTP request object containing parameters for card identification.
 * @param {Object} res - The HTTP response object for sending back the card data or errors.
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

        // Consumers can't read companies
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });

        // Clients can only read their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter._id = new mongoose.Types.ObjectId(req.params.id);
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;
    }

    const options = readCompanyCardFullData({ filter: filter });

    CommonHandler.aggregate(options, CompanyCardModel, (err, items) => {

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
 * Allows creating a new company card. Consumers are not allowed to create cards.
 * Clients can create cards only for their own company, ensuring that the card's company ID matches their company ID.
 * 
 * @param {Object} req - The HTTP request object containing new card data.
 * @param {Object} res - The HTTP response object for returning the newly created card data or errors.
 */
methods.create = async function (req, res) {

    switch (req.user.role) {

        // Consumers can't create cards
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });

        // Clients can only create cards for their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (req.body.company !== req.user.company_id) {
                    return res.status(401).json({
                        message: res.__("general.errors.forbidden")
                    });
                }
            }

            break;
    };

    const options = {
        data: req.body
    };

    await CommonHandler.create(options, CompanyCardModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(item);
    });
};

/**
 * Updates company card data based on the card's ID and the role of the requester.
 * Clients can only edit cards of their own company and are not allowed to edit cards of other companies.
 * Consumers are not permitted to edit any company cards.
 * 
 * @param {Object} req - The HTTP request object containing updates for the card.
 * @param {Object} res - The HTTP response object for returning the updated card data or errors.
 */
methods.update = async function (req, res) {

    let filter = {
        _id: req.params.id
    };

    switch (req.user.role) {

        // They can only edit cards for their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                filter._id = new mongoose.Types.ObjectId(req.params.id);
                filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers cant edit any card
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = {
        filter: filter,
        data: req.body
    };

    await CommonHandler.update(options, CompanyCardModel, (err, item) => {

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
 * Deletes a company card by setting its 'excluded' status to true. Only roles with sufficient permissions can delete cards,
 * and clients can only delete cards of their own company. The actual database records are not removed; they are simply marked as excluded.
 * 
 * @param {Object} req - The HTTP request object containing the ID of the card to delete.
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

        // They can only delete cards for their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {
                options.filter.company = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers can't delete companies
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    await CommonHandler.update(options, CompanyCardModel, (err, item) => {

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