const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { fakerPT_BR: faker } = require('@faker-js/faker');
const { fakerBr } = require('@js-brasil/fakerbr');

// Constants
const statusConsts = require("../constants/status.constants");
const roleConsts = require("../constants/roles.constants");
const dateConsts = require("../constants/dates.constants");

// Models
const UserModel = require("../models/user.model");
const CompanyModel = require("../models/company.model");
const CompanyCardModel = require("../models/company-card.model");
const UserCreditModel = require("../models/user-credit.model");

// Utils
const sanitizeUtils = require("../utils/sanitize.utils");

var methods = {};

methods.populateDummyData = async function (req, res) {

    const { companiesNum, usersNum, userCreditsNum, companyCardsNum, password } = req.body;

    if (!companiesNum || !usersNum || !userCreditsNum || !companyCardsNum) {
        return res.status(400).json({
            message: "Missing parameters"
        });
    }

    try {

        const companies = await createCompanies(companiesNum);
        const users = await createUsers(usersNum, companies, password);
        const companyCards = await createCompanyCards(companyCardsNum, companies);
        const userCredits = await createUserCredits(userCreditsNum, users, companyCards, companies);

        return res.status(200).json({
            companies,
            users,
            userCredits,
            companyCards
        });

    } catch (error) {
        return res.status(400).json({
            message: error.message
        });
    }
};

const createCompanies = async (num) => {

    const companies = [];

    for (let i = 0; i < num; i++) {
        companies.push(new CompanyModel({
            name: faker.company.name(),
            address: createCuritibaAddress(),
            status: faker.helpers.enumValue(statusConsts.RESOURCE_STATUS),
            document: fakerBr.cnpj(),
            excluded: faker.datatype.boolean(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent()
        }));
    }

    return CompanyModel.insertMany(companies);
};

const createUsers = async (num, companies, password) => {

    const users = [];

    for (let i = 0; i < num; i++) {

        const role = faker.helpers.enumValue(roleConsts.USER_ROLES);

        const user = {
            name: faker.person.fullName(),
            phone: sanitizeUtils.sanitizePhone(fakerBr.telefone()),
            password: bcrypt.hashSync(password, 10),
            status: faker.helpers.enumValue(statusConsts.RESOURCE_STATUS),
            role: role,
            company: role === roleConsts.USER_ROLES.CLIENT ? faker.helpers.arrayElement(companies)._id : null,
            excluded: faker.datatype.boolean(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent()
        };

        if (role === roleConsts.USER_ROLES.CLIENT) {
            user.email = faker.internet.email();
        }

        users.push(new UserModel(user));
    }

    return UserModel.insertMany(users);
};

const createCompanyCards = async (num, companies) => {

    const companyCards = [];

    for (let i = 0; i < num; i++) {
        companyCards.push(new CompanyCardModel({
            title: faker.commerce.productName(),
            company: faker.helpers.arrayElement(companies)._id,
            credits: faker.number.int({ min: 1, max: 10 }),
            credit_expires_at: {
                ref_number: faker.number.int({ min: 1, max: 12 }),
                ref_type: faker.helpers.enumValue(dateConsts.TYPES)
            },
            status: faker.helpers.enumValue(statusConsts.RESOURCE_STATUS),
            excluded: faker.datatype.boolean(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent()
        }));
    }

    return CompanyCardModel.insertMany(companyCards);
};

const createUserCredits = async (num, users, companyCards, companies) => {

    const userCredits = [];

    for (let i = 0; i < num; i++) {

        const status = faker.helpers.enumValue(statusConsts.CREDITS_STATUS);

        userCredits.push(new UserCreditModel({
            user: faker.helpers.arrayElement(users)._id,
            card: faker.helpers.arrayElement(companyCards)._id,
            company: faker.helpers.arrayElement(companies)._id,
            status: status,
            excluded: faker.datatype.boolean(),
            created_at: faker.date.past(),
            updated_at: faker.date.recent(),
            requested_at: status === statusConsts.CREDITS_STATUS.USED ? faker.date.past() : null
        }));
    }

    return UserCreditModel.insertMany(userCredits);
};

const createCuritibaAddress = () => ({
    street: faker.location.street(),
    number: faker.location.buildingNumber(),
    complement: faker.location.secondaryAddress(),
    neighborhood: faker.location.county(),
    city: 'Curitiba',
    state: 'PR',
    location: {
        type: 'Point',
        coordinates: [
            parseFloat(faker.location.longitude({
                max: -49.2,
                min: -49.3
            })),
            parseFloat(faker.location.latitude({
                max: -25.4,
                min: -25.6
            }))
        ]
    }
});

module.exports = methods;