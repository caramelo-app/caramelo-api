exports.listUserCreditFullData = (options) => {
    return [
        {
            $match: options.filter
        },
        {
            $lookup: {
                from: "companycards",
                localField: "card",
                foreignField: "_id",
                as: "card"
            }
        },
        {
            $unwind: "$card"
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: "$user"
        },
        {
            $group: {
                _id: "$card._id",
                title: { $first: "$card.title" },
                company: { $first: "$card.company" },
                credits: { $first: "$card.credits" },
                credit_expires_at: { $first: "$card.credit_expires_at" },
                status: { $first: "$card.status" },
                excluded: { $first: "$card.excluded" },
                created_at: { $first: "$card.created_at" },
                updated_at: { $first: "$card.updated_at" },
                __v: { $first: "$card.__v" },
                user_credits: {
                    $push: {
                        _id: "$_id",
                        card: "$card._id",
                        company: "$company",
                        status: "$status",
                        excluded: "$excluded",
                        created_at: "$created_at",
                        updated_at: "$updated_at",
                        requested_at: "$requested_at",
                        expires_at: "$expires_at",
                        __v: "$__v"
                    }
                },
                user: {
                    $first: "$user"
                }
            }
        }
    ];
};

exports.readUserCreditFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};