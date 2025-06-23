const mongoose = require("mongoose");

const statusConsts = require("../constants/status.constants");
const datesConstants = require("../constants/dates.constants");

const companyCardSchema = new mongoose.Schema(
  {
    title: {
      required: true,
      type: String,
    },
    company_id: {
      required: true,
      ref: "Company",
      type: mongoose.Schema.Types.ObjectId,
    },
    credits_needed: {
      required: true,
      type: Number,
    },
    credit_expires_at: {
      ref_number: {
        required: true,
        type: Number,
      },
      ref_type: {
        required: true,
        type: String,
        enum: Object.values(datesConstants.TYPES),
      },
    },
    status: {
      required: true,
      type: String,
      enum: Object.values(statusConsts.RESOURCE_STATUS),
    },
    excluded: {
      required: true,
      type: Boolean,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

companyCardSchema.index({ company_id: 1, status: 1, excluded: 1 });
companyCardSchema.index({ company_id: 1, excluded: 1 });

module.exports = mongoose.model("Card", companyCardSchema);
