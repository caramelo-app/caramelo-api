const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Constants
const statusConsts = require("../constants/status.constants");
const roleConsts = require("../constants/roles.constants");

// Models
const UserModel = require("../models/user.model");
const CompanyModel = require("../models/company.model");

// Handlers
const CommonHandler = require("../handlers/common.handler");
const SNSHandler = require("../handlers/sns.handler");

// Aggregations
const { readUserFullData } = require("../aggregations/user.agg");
const { getAuthData, checkIfAccountExists, checkIfPhoneExists } = require("../aggregations/user.agg");
const { checkIfCompanyExists } = require("../aggregations/company.agg");

// Utils
const sanitizeUtils = require("../utils/sanitize.utils");

var methods = {};

/**
 * Handles the signup process for new users and, optionally, new companies.
 * It first checks if the phone number is already in use. If not, it hashes the password,
 * generates a validation token, and creates a new user. If the user role is 'CLIENT', it will
 * also check if the company already exists and, if not, create a new company and link it to the user.
 * Finally, it sends a validation token via SMS.
 * 
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 */
methods.signup = async function (req, res) {

    // We need to sanitize the phone number to get only the numbers
    req.body.user.phone = sanitizeUtils.sanitizePhone(req.body.user.phone);

    const options = checkIfPhoneExists({ req: { body: { phone: req.body.user.phone } } });

    CommonHandler.aggregate(options, UserModel, (err, user) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (user && user.length > 0) {
            return res.status(400).json({
                message: res.__("general.errors.already_in_use", {
                    field: req.body.user.phone
                })
            });
        }

        // We need to hash the password before saving it to the database
        if (req.body.user.password) {
            req.body.user.password = bcrypt.hashSync(req.body.user.password, 10);
        }

        // Create a 5 digit code and send it to the user object
        const code = Math.floor(10000 + Math.random() * 90000);
        req.body.user.validation_token = code;
        req.body.user.validation_token_expires_at = Date.now() + 86400000; // 24 hours

        CommonHandler.create({
            data: req.body.user
        }, UserModel, async (err, user) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const validationTokenOptions = {
                phone: req.body.user.phone,
                timestamp: Date.now(),
                code: code,
                _id: user._id,
                res: res
            };

            if (req.body.user.role === roleConsts.USER_ROLES.CLIENT) {

                const options = checkIfCompanyExists({ req: { body: { document: req.body.company.document } } });

                CommonHandler.aggregate(options, CompanyModel, (err, company) => {

                    if (err) {
                        return res.status(400).json({ message: err.message });
                    }

                    if (company && company.length > 0) {
                        return res.status(400).json({
                            message: res.__("controllers.auth.signup.errors.company_already_in_use", {
                                document: req.body.company.document
                            })
                        });
                    }

                    CommonHandler.create({
                        data: req.body.company
                    }, CompanyModel, (err, company) => {

                        if (err) {
                            return res.status(400).json({ message: err.message });
                        }

                        CommonHandler.update({
                            filter: {
                                _id: user._id
                            },
                            data: {
                                company: {
                                    _id: company._id
                                }
                            }
                        }, UserModel, async (err, user) => {

                            if (err) {
                                return res.status(400).json({ message: err.message });
                            }

                            await sendValidationToken(validationTokenOptions, function (err) {

                                if (err) {
                                    return res.status(400).json({ message: err.message });
                                }

                                return res.status(200).json({
                                    user: user,
                                    company: company
                                });
                            });
                        });
                    });
                });
            }
            else {

                await sendValidationToken(validationTokenOptions, function (err) {

                    if (err) {
                        return res.status(400).json({ message: err.message });
                    }

                    // we need to remove user.validation_token and validation_token_expires_at from the response
                    delete user.validation_token;
                    delete user.validation_token_expires_at;

                    return res.status(200).json({
                        user: user
                    });
                });
            }
        });
    });
};

/**
 * Handles the user sign-in process. It checks if the user exists and matches the provided credentials.
 * If the credentials are valid, it generates a JWT token for session management.
 * 
 * @param {Object} req - The HTTP request object containing credentials.
 * @param {Object} res - The HTTP response object used to send the response.
 */
methods.signin = function (req, res) {

    if (!req.body.phone || !req.body.password) {
        return res.status(400).json({ message: res.__("controllers.auth.signin.errors.missing_credentials") });
    }

    // We need to sanitize the phone number to get only the numbers
    req.body.phone = sanitizeUtils.sanitizePhone(req.body.phone);

    // We must get the user from the database
    const options = getAuthData({ req: req });

    CommonHandler.aggregate(options, UserModel, (err, user) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        // If the user doesn't exist, we must return an error
        if (!user || user.length === 0) {
            return res.status(400).json({ message: res.__("controllers.auth.signin.errors.user_not_found") });
        }

        // The user must be available
        if (user[0].excluded || user[0].status !== statusConsts.RESOURCE_STATUS.AVAILABLE) {
            return res.status(401).json({ message: res.__("controllers.auth.signin.errors.user_not_found") });
        }

        // We must compare the password
        const passwordIsValid = bcrypt.compareSync(req.body.password, user[0].password);

        if (!passwordIsValid) {
            return res.status(401).json({ message: res.__("controllers.auth.signin.errors.invalid_password") });
        }

        const fieldsToPayload = {
            _id: user[0]._id,
            role: user[0].role
        }

        // If the user has the company object, we need to pass it into the user object in the payload
        if (user[0].company) {
            fieldsToPayload.company_id = user[0].company._id;
        }

        // We must create a token
        const token = jwt.sign(fieldsToPayload, process.env.JWT_SECRET, {
            expiresIn: (req.body.remember) ? 86400 * 30 : 86400 // 24 hours or 30 days 
        });

        return res.status(200).json({ auth: true, token: token });
    });
};

/**
 * Middleware for authenticating JWT tokens. It verifies the token from the Authorization header.
 * If the token is valid, it adds the user details to the request object for use in subsequent middleware or endpoints.
 * 
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object used to send the response.
 * @param {Function} next - The next middleware function in the stack.
 */
methods.authenticate = function (req, res, next) {

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: res.__("controllers.auth.authenticate.errors.no_token_provided")
        }).end();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).json({
                message: res.__("controllers.auth.authenticate.errors.invalid_token")
            }).end();
        }

        // We need to send the user id to the next middleware
        req.user = {};
        req.user._id = decoded._id;
        req.user.role = decoded.role;
        req.user.company_id = (decoded.company_id) ? decoded.company_id : null;

        return next();
    });

};

/**
 * Authorization middleware that checks if the logged-in user's role matches any of the roles required for a specific route.
 * If the user's role is not allowed, it sends a 403 Forbidden response.
 * 
 * @param {Array} permissions - An array of permitted roles.
 * @returns {Function} - Middleware function that checks user's role against permitted roles.
 */
methods.authorize = function (permissions) {

    return (req, res, next) => {

        const userRole = req.user.role;

        if (!permissions.includes(userRole)) {
            return res.status(403).json({
                message: res.__("general.errors.forbidden")
            }).end();
        }

        return next();
    };
};

/**
 * Validates a user's account by checking the provided token against the stored validation token.
 * If the tokens match and the token has not expired, it updates the user's status to 'AVAILABLE'.
 * 
 * @param {Object} req - The HTTP request object containing the validation token.
 * @param {Object} res - The HTTP response object used to send the response.
 */
methods.validateAccount = function (req, res) {

    // We need to check if the body contains the JWT Token
    if (!req.body.token) {
        return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.missing_token") });
    }

    if (!req.body.phone) {
        return res.status(400).json({ message: res.__("general.errors.missing_phone") });
    }
    else {

        // We need to sanitize the phone number to get only the numbers
        req.body.phone = sanitizeUtils.sanitizePhone(req.body.phone);
    }

    const options = checkIfAccountExists({ req: { body: { phone: req.body.phone } } });

    CommonHandler.aggregate(options, UserModel, (err, user) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!user || user.length === 0) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.user_not_found") });
        }

        // Check if the user is pending
        if (user[0].status !== statusConsts.RESOURCE_STATUS.PENDING) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.user_not_pending") });
        }

        // Match the validation_token
        if (req.body.token !== user[0].validation_token) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.invalid_token") });
        }

        // Check if the token has expired
        const expirationDate = new Date(user[0].validation_token_expires_at);

        if (expirationDate < Date.now()) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.expired_token") });
        }

        // We need to update the user status to AVAILABLE
        CommonHandler.update({
            filter: {
                _id: user[0]._id
            },
            data: {
                status: statusConsts.RESOURCE_STATUS.AVAILABLE
            }
        }, UserModel, (err) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            // We need to generate a token for the user
            const fieldsToPayload = {
                _id: user[0]._id,
                role: user[0].role
            }

            // If the user has the company object, we need to pass it into the user object in the payload
            if (user[0].company) {
                fieldsToPayload.company_id = user[0].company._id;
            }

            // We must create a token
            const token = jwt.sign(fieldsToPayload, process.env.JWT_SECRET, {
                expiresIn: 86400 // 24 hours
            });

            return res.status(200).json({ auth: true, token: token });
        });
    });
};

/**
 * Sends a new validation token to the user's phone number. It generates a new 5-digit code and sends it via SMS.
 * 
 * @param {Object} req - The HTTP request object containing the phone number.
 * @param {Object} res - The HTTP response object used to send the response.
 */
methods.forgotPassword = function (req, res) {

    if (!req.body.phone) {
        return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.missing_phone") });
    }
    else {
        req.body.phone = sanitizeUtils.sanitizePhone(req.body.phone);
    }

    const options = checkIfAccountExists({ req: { body: { phone: req.body.phone } } });

    CommonHandler.aggregate(options, UserModel, (err, user) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!user || user.length === 0) {
            return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.user_not_found") });
        }

        // We need to generate a new validation token
        const code = Math.floor(10000 + Math.random() * 90000);
        user[0].validation_token = code;
        user[0].validation_token_expires_at = Date.now() + 86400000; // 24 hours

        CommonHandler.update({
            filter: {
                _id: user[0]._id
            },
            data: {
                validation_token: code,
                validation_token_expires_at: user[0].validation_token_expires_at
            }
        }, UserModel, async (err) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const validationTokenOptions = {
                phone: req.body.phone,
                timestamp: Date.now(),
                code: code,
                _id: user[0]._id,
                res: res
            };

            await sendValidationToken(validationTokenOptions, function (err) {

                if (err) {
                    return res.status(400).json({ message: err.message });
                }

                return res.status(200).json({ message: res.__("controllers.auth.forgot_password.success") });
            });
        });
    });
};

/**
 * Validates the user's account by checking the provided token against the stored validation token.
 * 
 * @param {Object} req - The HTTP request object containing the phone number and token.
 * @param {Object} res - The HTTP response object used to send the response.
 */
methods.forgotPasswordValidation = function (req, res) {

    // We need to check if the body contains the JWT Token
    if (!req.body.token) {
        return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.missing_token") });
    }

    if (!req.body.phone) {
        return res.status(400).json({ message: res.__("general.errors.missing_phone") });
    }
    else {

        // We need to sanitize the phone number to get only the numbers
        req.body.phone = sanitizeUtils.sanitizePhone(req.body.phone);
    }

    const options = checkIfAccountExists({ req: { body: { phone: req.body.phone } } });

    CommonHandler.aggregate(options, UserModel, (err, user) => {

        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!user || user.length === 0) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.user_not_found") });
        }

        // Match the validation_token
        if (req.body.token !== user[0].validation_token) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.invalid_token") });
        }

        // Check if the user is available
        if (user[0].status !== statusConsts.RESOURCE_STATUS.AVAILABLE) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.user_not_available") });
        }

        // Check if the token has expired
        const expirationDate = new Date(user[0].validation_token_expires_at);

        if (expirationDate < Date.now()) {
            return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.expired_token") });
        }

        const fieldsToPayload = {
            phone: user[0].phone,
            token: user[0].validation_token
        };

        const token = jwt.sign(fieldsToPayload, process.env.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });

        return res.status(200).json({
            message: {
                token: token
            }
        });
    });
};

/**
 * Resets the user's password by checking the provided token against the stored validation token.
 * 
 * @param {Object} req - The HTTP request object containing the phone number, token, and new password.
 * @param {Object} res - The HTTP response object used to send the response.
 */
methods.resetPassword = function (req, res) {

    if (!req.body.token) {
        return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.missing_token") });
    }

    if (!req.body.password) {
        return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.missing_password") });
    }

    // We need to uncrypt the token jwt
    jwt.verify(req.body.token, process.env.JWT_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).json({
                message: res.__("controllers.auth.authenticate.errors.invalid_token")
            }).end();
        }

        const options = checkIfAccountExists({ req: { body: { phone: decoded.phone } } });

        CommonHandler.aggregate(options, UserModel, (err, user) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            if (!user || user.length === 0) {
                return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.user_not_found") });
            }

            // Match the validation_token
            if (decoded.token !== user[0].validation_token) {
                return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.invalid_token") });
            }

            // Check if the token has expired
            const expirationDate = new Date(user[0].validation_token_expires_at);

            if (expirationDate < Date.now()) {
                return res.status(400).json({ message: res.__("controllers.auth.forgot_password.errors.expired_token") });
            }

            // We need to hash the password before saving it to the database
            req.body.password = bcrypt.hashSync(req.body.password, 10);

            CommonHandler.update({
                filter: {
                    _id: user[0]._id
                },
                data: {
                    password: req.body.password,
                    validation_token: null,
                    validation_token_expires_at: null
                }
            }, UserModel, (err) => {

                if (err) {
                    return res.status(400).json({ message: err.message });
                }

                return res.status(200).json({ message: res.__("controllers.auth.forgot_password.success") });
            });
        });
    });
}

/**
 * Helper function to send a validation token via SMS using the AWS SNS service.
 * It constructs the message and sends it to the specified phone number.
 * 
 * @param {Object} options - Contains phone number and the code to be sent.
 * @param {Function} callback - Callback function to execute after attempting to send the SMS.
 */
async function sendValidationToken(options, callback) {

    // We need to generate a 5 digit code and send it to the user's phone using an SMS service
    // We will use the AWS SDK to send the SMS using the SNS service
    const code = options.code;

    const snsOptions = {
        phoneNumber: options.phone,
        message: options.res.__(`controllers.auth.send_validation_token.message`, { code: code })
    };

    SNSHandler.sendSMS(snsOptions, function (err) {

        if (err) {
            return callback(err);
        }

        return callback();
    });

};

methods.getUserData = function (req, res) {

    // we need to get the token from the headers
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({
            message: res.__("controllers.auth.authenticate.errors.no_token_provided")
        }).end();
    }

    // Remove bearer from the token
    const token = authHeader.split(" ")[1];

    // extract the JWT token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).json({
                message: res.__("controllers.auth.authenticate.errors.invalid_token")
            }).end();
        }

        const options = readUserFullData({
            filter: {
                _id: new mongoose.Types.ObjectId(decoded._id)
            }
        });

        CommonHandler.aggregate(options, UserModel, (err, user) => {

            if (err) {
                return res.status(400).json({ message: err.message });
            }

            if (!user || user.length === 0) {
                return res.status(400).json({ message: res.__("controllers.auth.validate_account.errors.user_not_found") });
            }

            return res.status(200).json({
                user: user[0]
            });
        });
    });
};

module.exports = methods;