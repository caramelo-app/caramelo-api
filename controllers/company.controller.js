const mongoose = require("mongoose");

// Consts
const statusConsts = require("../constants/status.constants");
const roleConsts = require("../constants/roles.constants");

// Models
const CompanyModel = require("../models/company.model");
const UserModel = require("../models/user.model");
const UserCreditModel = require("../models/user-credit.model");

// Handlers
const CommonHandler = require("../handlers/common.handler");
const EmailHandler = require("../handlers/email.handler");

// Aggregations
const { readCompanyFullData, listCompanyFullData, listCompanyConsumers, getDashboardDataClientsOnLastWeeks, getDashboardDataLastClients } = require("../aggregations/company.agg");

// Utils
const dateUtils = require("../utils/date.utils");

var methods = {};

/**
 * Lists available companies based on the role of the requester. Clients and consumers are not allowed to list companies.
 * The method filters out excluded companies and those not marked as available.
 * 
 * @param {Object} req - The HTTP request object containing user role and filter criteria.
 * @param {Object} res - The HTTP response object for sending back the company data or errors.
 */
methods.list = async function (req, res) {

    let filter = {};
    filter.excluded = false;
    filter.status = statusConsts.RESOURCE_STATUS.AVAILABLE;

    switch (req.user.role) {

        // Consumers and clients can't list
        case roleConsts.USER_ROLES.CLIENT:
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = listCompanyFullData({ filter: filter });

    CommonHandler.aggregate(options, CompanyModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(items);
    });
};

/**
 * List users containing the role "consumer" and have user credits on the logged company.
 * @param {*} req 
 * @param {*} res 
 */
methods.listConsumers = async function (req, res) {

    // Clients can only read their own company
    switch (req.user.role) {
        case roleConsts.USER_ROLES.CONSUMER:
            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    let filter = {
        company: new mongoose.Types.ObjectId(req.user.company_id)
    };

    const options = listCompanyConsumers({ filter: filter });

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
 * Retrieves detailed information for a single company based on its ID. Security measures ensure that
 * consumers cannot access company data, and clients can only access their own company's data.
 * 
 * @param {Object} req - The HTTP request object containing parameters for company identification.
 * @param {Object} res - The HTTP response object for sending back the company data or errors.
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

        // Clients can only read their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (req.user.company_id !== req.params.id) {
                    return res.status(401).json({
                        message: res.__("general.errors.forbidden")
                    });
                }

                filter._id = new mongoose.Types.ObjectId(req.user.company_id);
            }

            break;
    }

    const options = readCompanyFullData({ filter: filter });

    CommonHandler.aggregate(options, CompanyModel, (err, items) => {

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
 * Allows creating a new company. Only roles with sufficient permissions (not consumers) can create companies.
 * The method captures and persists company data provided in the request body.
 * 
 * @param {Object} req - The HTTP request object containing new company data.
 * @param {Object} res - The HTTP response object for returning the newly created company data or errors.
 */
methods.create = async function (req, res) {

    switch (req.user.role) {

        // Consumers and Clients can't create companies
        case roleConsts.USER_ROLES.CONSUMER:
        case roleConsts.USER_ROLES.CLIENT:
            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    };

    const options = {
        data: req.body
    };

    await CommonHandler.create(options, CompanyModel, (err, item) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(item);
    });
};

/**
 * Updates company data based on the company's ID and the role of the requester. Clients can only edit their own company's data.
 * Consumers are not permitted to edit any company data.
 * 
 * @param {Object} req - The HTTP request object containing company updates.
 * @param {Object} res - The HTTP response object for returning the updated company data or errors.
 */
methods.update = async function (req, res) {

    let filter = {
        _id: req.params.id
    };

    switch (req.user.role) {

        // They can only edit their own company
        case roleConsts.USER_ROLES.CLIENT:

            if (req.user.company_id) {

                if (req.user.company_id !== req.params.id) {
                    return res.status(401).json({
                        message: res.__("general.errors.forbidden")
                    });
                }

                filter._id = new mongoose.Types.ObjectId(req.user.company_id);
            }
            else {
                return res.status(401).json({
                    message: res.__("general.errors.forbidden")
                });
            }

            break;

        // Consumers cant edit any company
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    const options = {
        filter: filter,
        data: req.body
    };

    await CommonHandler.update(options, CompanyModel, (err, item) => {

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
 * Deletes a company by setting their 'excluded' status to true. Only roles with sufficient permissions can delete companies.
 * The actual database records are not removed; they are simply marked as excluded.
 * 
 * @param {Object} req - The HTTP request object containing the ID of the company to delete.
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

        // Consumers and clients can't delete companies
        case roleConsts.USER_ROLES.CLIENT:
        case roleConsts.USER_ROLES.CONSUMER:

            return res.status(401).json({
                message: res.__("general.errors.forbidden")
            });
    }

    await CommonHandler.update(options, CompanyModel, (err, item) => {

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
 * Handles the process of a company requesting a trial of the services. Validates the request body,
 * sends an acknowledgment email to the potential customer, and notifies the Caramelo team about the new interest.
 * 
 * @param {Object} req - The HTTP request object containing the company's trial request information.
 * @param {Object} res - The HTTP response object for sending email responses or errors.
 */
methods.createTrialRequest = function (req, res) {

    // We need to check the body fields if they exists
    if (!req.body) {
        return res.status(400).json({
            message: res.__("general.errors.invalid_body")
        });
    }

    if (!req.body.name) {
        return res.status(400).json({
            message: res.__("general.errors.field_required", { field: "Nome" })
        });
    }

    if (!req.body.email) {
        return res.status(400).json({
            message: res.__("general.errors.field_required", { field: "E-mail" })
        });
    }

    if (!req.body.phone) {
        return res.status(400).json({
            message: res.__("general.errors.field_required", { field: "Telefone" })
        });
    }

    if (!req.body.city) {
        return res.status(400).json({
            message: res.__("general.errors.field_required", { field: "Cidade" })
        });
    }

    // First we send an email to the company
    const emailOptions = {
        sender: {
            email: "noreply@caramelo.com.br",
            name: "Caramelo"
        },
        to: {
            email: req.body.email,
            name: "Caramelo"
        },
        subject: "Obrigado pelo interesse no Caramelo",
        template: "business-trial-customer"
    };

    EmailHandler.send(emailOptions, function (err) {

        if (err) {
            return res.status(400).json({
                message: err
            });
        }

        // Now we send an email to the Caramelo team
        const emailOptions = {
            sender: {
                email: "noreply@caramelo.com.br",
                name: "Caramelo"
            },
            to: {
                email: process.env.ADMIN_EMAIL,
                name: "Caramelo"
            },
            subject: res.__("email.trial_request.subject"),
            template: "business-trial-team",
            body: req.body
        };

        EmailHandler.send(emailOptions, function (err) {

            if (err) {
                return res.status(400).json({
                    message: err
                });
            }

            return res.status(200).json({
                message: res.__("email.trial_request.success")
            });
        });
    });
};

/**
 * Lists available companies based on the current coordinates given by the user.
 * 
 * @param {*} req.query.lat - The latitude of the user's current location.
 * @param {*} req.query.lng - The longitude of the user's current location.
 * @param {*} req.query.distance - The maximum distance in kilometers to search for companies.
 * @param {*} res 
 * @returns {Object} - The list of companies within the specified distance.
 */
methods.explore = async function (req, res) {

    let { lat, lng, distance } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({
            message: res.__("controllers.companies.explorer.errors.invalid_coordinates")
        });
    }

    // Handle distance
    if (!distance) {
        distance = process.env.EXPLORE_DEFAULT_DISTANCE;
    }
    else {
        // Limit to 10km
        if (distance > 10) {
            distance = 10;
        }
    }

    distance = distance * 1000;

    const options = {
        filter: {
            "address.location": {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: distance
                }
            }
        }
    };

    await CommonHandler.list(options, CompanyModel, (err, items) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(200).json(items);
    });
};

methods.dashboardStats = async function (req, res) {

    // Generate arrays to be used to populate the users per week
    const weeksArray = [];

    for (let i = 0; i < 4; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        date.setUTCHours(0, 0, 0, 0);
        weeksArray.push({
            date: new Date(date),
            count: 0
        });
    }

    weeksArray.sort((a, b) => a.date - b.date);

    // clone weeksarray to be used
    const cloneWeeksArray = (array) => {
        return array.map(item => ({
            date: new Date(item.date),
            count: item.count
        }));
    };

    const clientsPerWeekArray = cloneWeeksArray(weeksArray);
    const creditsGivenPerWeekArray = cloneWeeksArray(weeksArray);
    const creditsTakenPerWeekArray = cloneWeeksArray(weeksArray);

    // Cut off date for the last 4 weeks
    const cutoffDate = dateUtils.setCutoffDate(4);

    // Get the clients created on the last 4 weeks that used company cards
    const clientsPerWeekOptions = getDashboardDataClientsOnLastWeeks({
        cutoffDate: cutoffDate,
        company: new mongoose.Types.ObjectId(req.user.company_id)
    });

    await CommonHandler.aggregate(clientsPerWeekOptions, UserModel, async (err, clients) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        // now we need to get the clients and sort them by weeks using the clientsPerWeekArray
        // if the date is between the week date and the week date + 7 days, we increment the count
        clients.forEach(client => {

            clientsPerWeekArray.forEach(week => {

                let weekStartDate = new Date(week.date);
                let weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekStartDate.getDate() + 7);

                if (client.created_at >= weekStartDate && client.created_at < weekEndDate) {
                    week.count++;
                }
            });
        });

        // Get the credits given on the last 4 weeks
        const creditsGivenOptions = {
            filter: {
                created_at: {
                    $gte: cutoffDate
                },
                company: new mongoose.Types.ObjectId(req.user.company_id),
                excluded: false,
                status: {
                    $ne: statusConsts.CREDITS_STATUS.PENDING
                }
            },
            projection: {
                created_at: 1
            }
        };

        await CommonHandler.list(creditsGivenOptions, UserCreditModel, async (err, creditsGiven) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            creditsGiven.forEach(credit => {

                creditsGivenPerWeekArray.forEach(week => {

                    let weekStartDate = new Date(week.date);
                    let weekEndDate = new Date(weekStartDate);
                    weekEndDate.setDate(weekStartDate.getDate() + 7);

                    if (credit.created_at >= weekStartDate && credit.created_at < weekEndDate) {
                        week.count++;
                    }
                });
            });

            // Get the credits taken on the last 4 weeks
            const creditsTakenOptions = {
                filter: {
                    created_at: {
                        $gte: cutoffDate
                    },
                    company: new mongoose.Types.ObjectId(req.user.company_id),
                    excluded: false,
                    status: {
                        $eq: statusConsts.CREDITS_STATUS.USED
                    }
                },
                projection: {
                    created_at: 1
                }
            };

            await CommonHandler.list(creditsTakenOptions, UserCreditModel, async (err, creditsTaken) => {

                if (err) {
                    return res.status(400).json({ message: err.message });
                }

                creditsTaken.forEach(credit => {

                    creditsTakenPerWeekArray.forEach(week => {

                        let weekStartDate = new Date(week.date);
                        let weekEndDate = new Date(weekStartDate);
                        weekEndDate.setDate(weekStartDate.getDate() + 7);

                        if (credit.created_at >= weekStartDate && credit.created_at < weekEndDate) {
                            week.count++;
                        }
                    });
                });

                // Get the clients created on the last 4 weeks that used company cards
                const lastClientsOptions = getDashboardDataLastClients({
                    company: new mongoose.Types.ObjectId(req.user.company_id)
                });

                await CommonHandler.aggregate(lastClientsOptions, UserCreditModel, async (err, clients) => {

                    if (err) {
                        return res.status(400).json({ message: err.message });
                    }

                    return res.status(200).json({
                        lastClients: clients,
                        clientsLastWeeks: clientsPerWeekArray,
                        creditsGivenLastWeeks: creditsGivenPerWeekArray,
                        creditsTakenLastWeeks: creditsTakenPerWeekArray
                    });
                });
            });
        });
    });
};

module.exports = methods;