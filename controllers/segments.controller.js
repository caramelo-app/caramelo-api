const segmentModel = require("../models/segment.model");
const dbHandler = require("../utils/db-handler.utils");
const statusConsts = require("../constants/status.constants");

const segmentHandler = dbHandler(segmentModel);

/**
 * @swagger
 * /v1/segments:
 *   get:
 *     summary: Get segments
 *     description: Retrieve all available business segments
 *     tags: [Segments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Segments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Segment'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
