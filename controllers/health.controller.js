const mongoose = require("mongoose");

const { MONGO_STATUS } = require("../constants/mongo.constants");

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: Health check
 *     description: Check if the API is running and healthy
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 mongo:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       description: MongoDB connection status
 *                       example: "connected"
 *                     readyState:
 *                       type: number
 *                       description: MongoDB connection ready state
 *                       example: 1
 *       500:
 *         description: API is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function health(req, res) {
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongo: {
      status: MONGO_STATUS[mongoose.connection.readyState] || "unknown",
      readyState: mongoose.connection.readyState,
    },
  });
}

module.exports = {
  health,
};
