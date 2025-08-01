const mongoose = require("mongoose");

const statusConsts = require("../constants/status.constants");

const creditSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    card_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyCard",
      required: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    status: {
      required: true,
      type: String,
      enum: Object.values(statusConsts.CREDITS_STATUS),
    },
    excluded: {
      default: false,
      type: Boolean,
    },
    requested_at: {
      type: Date,
      default: null,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

creditSchema.index({ user_id: 1, status: 1, excluded: 1 });
creditSchema.index({ card_id: 1 });
creditSchema.index({ expires_at: 1 });
creditSchema.index({ user_id: 1, card_id: 1 });
creditSchema.index({ company_id: 1, excluded: 1, created_at: -1 });
creditSchema.index({ company_id: 1, excluded: 1, status: 1 });

module.exports = mongoose.model("Credit", creditSchema);
