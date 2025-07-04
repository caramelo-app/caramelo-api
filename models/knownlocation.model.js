const mongoose = require("mongoose");

const knownLocationSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);
knownLocationSchema.index({ zipcode: 1, number: 1 });

module.exports = mongoose.model("KnownLocation", knownLocationSchema);
