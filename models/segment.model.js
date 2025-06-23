const mongoose = require("mongoose");

const statusConsts = require("../constants/status.constants");

const segmentSchema = new mongoose.Schema(
  {
    name: {
      required: true,
      type: String,
    },
    icon: {
      required: true,
      type: String,
    },
    description: {
      required: true,
      type: String,
    },
    status: {
      required: true,
      type: String,
      enum: Object.values(statusConsts.RESOURCE_STATUS),
      default: statusConsts.RESOURCE_STATUS.PENDING,
    },
    excluded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

segmentSchema.index({ status: 1, excluded: 1 });

module.exports = mongoose.model("Segment", segmentSchema);
