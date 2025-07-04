const mongoose = require("mongoose");

const statusConsts = require("../constants/status.constants");

const { localize } = require("../utils/localization.utils");
const { validateDocument } = require("../utils/validation.utils");

const companySchema = new mongoose.Schema(
  {
    name: {
      required: true,
      type: String,
    },
    phone: {
      type: String,
    },
    address: {
      zipcode: {
        required: true,
        type: String,
      },
      street: {
        required: true,
        type: String,
      },
      number: {
        required: true,
        type: Number,
      },
      complement: {
        type: String,
      },
      neighborhood: {
        required: true,
        type: String,
      },
      city: {
        required: true,
        type: String,
      },
      state: {
        required: true,
        type: String,
      },
      location: {
        type: {
          type: String,
          enum: ["Point"],
          required: true,
        },
        coordinates: {
          type: [Number],
          required: true,
        },
      },
    },
    logo: {
      type: String,
      default: null,
    },
    segment: {
      required: true,
      type: Object,
      ref: "Segment",
    },
    status: {
      required: true,
      type: String,
      enum: Object.values(statusConsts.RESOURCE_STATUS),
    },
    document: {
      required: true,
      type: String,
      unique: true,
      validate: {
        validator: function (v) {
          return validateDocument(v);
        },
        message: (props) =>
          localize("infra.model.company.document.invalid", {
            document: props.value,
          }),
      },
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

companySchema.index({ "address.location.coordinates": "2dsphere" });

companySchema.index({ status: 1, excluded: 1 });
companySchema.index({ "segment._id": 1 });

module.exports = mongoose.model("Company", companySchema);
