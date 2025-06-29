const segmentModel = require("../models/segment.model");
const dbHandler = require("../utils/db-handler.utils");
const statusConsts = require("../constants/status.constants");

const segmentHandler = dbHandler(segmentModel);

async function getSegments(req, res, next) {
  try {
    const segmentListOptions = {
      filter: {
        status: statusConsts.RESOURCE_STATUS.AVAILABLE,
        excluded: false,
      },
      projection: {
        name: 1,
        icon: 1,
        description: 1,
      },
      sort: {
        name: 1,
      },
    };

    const segments = await segmentHandler.list(segmentListOptions);

    return res.status(200).json(segments);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSegments,
};
