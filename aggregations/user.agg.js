exports.listUserFullData = (options) => {

    return [
        {
            $match: options.filter
        },
        {
            $lookup: {
                from: "companies",
                localField: "company",
                foreignField: "_id",
                as: "company"
            }
        },
        {
            $unwind: {
                path: "$company",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                password: 0
            }
        }
    ];
};

exports.readUserFullData = (options) => {

    return [
        {
            $match: options.filter
        },
        {
            $lookup: {
                from: "companies",
                localField: "company",
                foreignField: "_id",
                as: "company"
            }
        },
        {
            $unwind: {
                path: "$company",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                password: 0,
                validation_token: 0,
                validation_token_expires_at: 0
            }
        }
    ];
};

exports.getAuthData = (options) => {

    return [
        {
            $match: {
                phone: options.req.body.phone
            },
        },
        {
            $lookup: {
                from: "companies",
                localField: "company",
                foreignField: "_id",
                as: "company"
            }
        },
        {
            $unwind: {
                path: "$company",
                preserveNullAndEmptyArrays: true
            }
        }
    ];
};

exports.checkIfEmailExists = (options) => {

    return [
        {
            $match: {
                email: options.req.body.email
            }
        },
        {
            $project: {
                _id: 0,
                email: {
                    $ifNull: ["$email", "null"]
                }
            }
        }
    ];
};

exports.checkIfAccountExists = (options) => {

    return [
        {
            $match: {
                phone: options.req.body.phone
            }
        }
    ];
}

exports.checkIfPhoneExists = (options) => {

    return [
        {
            $match: {
                phone: options.req.body.phone
            }
        }
    ];
}