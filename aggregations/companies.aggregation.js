const { ObjectId } = require("../utils/data.utils");
const statusConsts = require("../constants/status.constants");

function getClientConsumersAggregation(options) {
  const aggregation = [
    {
      $match: {
        company_id: ObjectId(options.company_id),
        excluded: false,
      },
    },
    {
      $group: {
        _id: "$user_id",
        lastCreditDate: { $max: "$created_at" },
      },
    },
    {
      $sort: { lastCreditDate: -1 },
    },
  ];

  if (options.limit) {
    aggregation.push({
      $limit: options.limit,
    });
  }

  aggregation.push(
    {
      $lookup: {
        from: "users",
        let: {
          user_id: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$user_id"] },
                  { $eq: ["$status", statusConsts.RESOURCE_STATUS.AVAILABLE] },
                  { $eq: ["$excluded", false] },
                ],
              },
            },
          },
        ],
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $project: {
        name: "$user.name",
        phone: "$user.phone",
        created_at: "$user.created_at",
      },
    },
  );

  return aggregation;
}

function getNewClientsAggregationLast4Weeks(options) {
  const aggregation = [
    {
      $match: {
        company_id: ObjectId(options.company_id),
        excluded: false,
        created_at: { $gte: options.baseDate },
      },
    },
    {
      $group: {
        _id: "$user_id",
        created_at: { $last: "$created_at" },
      },
    },
    {
      $project: {
        created_at: 1,
      },
    },
  ];

  return aggregation;
}

module.exports = {
  getClientConsumersAggregation,
  getNewClientsAggregationLast4Weeks,
};
