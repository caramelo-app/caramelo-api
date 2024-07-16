const mongoose = require("mongoose");

// Consts
const roleConsts = require("../constants/roles.constants");
const statusConsts = require("../constants/status.constants");

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
                company: options.filter.company,
                excluded: false
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
                                    { $eq: ["$_id", "$$userId"] },
                                    { $eq: ["$status", statusConsts.RESOURCE_STATUS.AVAILABLE] },
                                    { $eq: ["$excluded", false] }
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
                excluded: 0,
                validation_token: 0,
                validation_token_expires_at: 0,
                __v: 0
            }
        }
    ];
};

exports.getDashboardDataClientsOnLastWeeks = (options) => {

    return [
        {
            $match: {
                role: roleConsts.USER_ROLES.CONSUMER,
                created_at: {
                    $gte: options.cutoffDate
                },
                status: statusConsts.RESOURCE_STATUS.AVAILABLE
            }
        },
        {
            $lookup: {
                from: "usercredits",
                let: {
                    "userId": "$_id",
                    "companyId": options.company
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$user", "$$userId"] },
                                    { $eq: ["$company", "$$companyId"] }
                                ]
                            }
                        }
                    },
                    {
                        $count: "creditsCount"
                    }
                ],
                as: "credits"
            }
        },
        {
            $addFields: {
                "credits": {
                    $cond: {
                        if: {
                            $gt: [
                                {
                                    "$size": "$credits"
                                },
                                0
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $match: {
                credits: true
            }
        },
        {
            $project: {
                created_at: 1
            }
        }
    ];
};

exports.getDashboardDataLastClients = (options) => {

    return [
        {
            $match: {
                company: options.company,
                excluded: false
            }
        },
        {
            $lookup: {
                from: "users",
                let: {
                    userId: "$user"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: [
                                    "$_id",
                                    "$$userId"
                                ]
                            },
                            role: roleConsts.USER_ROLES.CONSUMER
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            created_at: 1
                        }
                    }
                ],
                as: "userInfo"
            }
        },
        {
            $unwind: "$userInfo"
        },
        {
            $group: {

                _id: "$userInfo._id",
                name: {
                    $first: "$userInfo.name"
                },
                created_at: {
                    $first: "$userInfo.created_at"
                }

            },
        },
        {
            $sort: { created_at: -1 }
        },
        {
            $limit: 5
        },
        {
            $project: {
                _id: 1,
                name: 1,
                created_at: 1
            }
        }
    ];
};