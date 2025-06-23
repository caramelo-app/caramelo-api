const mongoose = require("mongoose");

const { MONGO_STATUS } = require("../constants/mongo.constants");

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
