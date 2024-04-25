exports.checkIfCompanyExists = (options) => {

    return [
        {
            $match: {
                document: options.req.body.document
            }
        },
        {
            $project: {
                _id: 0,
                document: {
                    $ifNull: ["$document", "null"]
                }
            }
        }
    ];

};

exports.listCompanyFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};

exports.readCompanyFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};

exports.listCompanyConsumers = (options) => {

    return [
        {
            $match: {
                company: options.filter._id,
            }
        },
        {
            $project: {
                user: 1
            }
        },
        {
            $lookup: {
                from: "users",
                as: "user",
                let: {
                    userId: "$user"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$_id", "$$userId"]
                                    },
                                    {
                                        $eq: ["$status", "available"]
                                    },
                                    {
                                        $eq: ["$excluded", false]
                                    }
                                ]
                            }
                        }
                    }
                ],
            }
        },
        {
            $unwind: "$user"
        },
        {
            $replaceRoot: {
                newRoot: "$user"
            }
        },
        {
            $project: {
                password: 0,
                role: 0,
                excluded: 0
            }
        }
    ];

};