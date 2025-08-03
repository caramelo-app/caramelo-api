const mongoose = require("mongoose");

const passwordUtils = require("../utils/password.utils");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");

const { localize } = require("../utils/localization.utils");
const { validatePhone } = require("../utils/validation.utils");

const userSchema = new mongoose.Schema(
  {
    name: {
      required: true,
      type: String,
    },
    phone: {
      required: function () {
        return this.role === roleConstants.USER_ROLES.CONSUMER;
      },
      type: String,
      validate: {
        validator: function (v) {
          return validatePhone(v);
        },
        message: (props) =>
          localize("error.infra.model.user.phone.invalid", {
            phone: props.value,
          }),
      },
    },
    password: {
      type: String,
    },
    status: {
      required: true,
      type: String,
      enum: Object.values(statusConsts.RESOURCE_STATUS),
      default: statusConsts.RESOURCE_STATUS.PENDING,
    },
    role: {
      required: true,
      type: String,
      enum: Object.values(roleConstants.USER_ROLES),
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
    },
    excluded: {
      type: Boolean,
      default: false,
    },
    validation_token: {
      type: String,
      default: null,
    },
    validation_token_expires_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await passwordUtils.hash(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash password before updating
userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (!update || !update.password) return next();

  try {
    update.password = await passwordUtils.hash(update.password);
    this.setUpdate(update);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.index({ company_id: 1, status: 1, excluded: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ validation_token: 1 });
userSchema.index({ validation_token_expires_at: 1 });
userSchema.index({ company_id: 1, role: 1, status: 1 });
userSchema.index({ validation_token: 1, validation_token_expires_at: 1 });
userSchema.index({ status: 1, excluded: 1, name: 1 });
userSchema.index({ status: 1, excluded: 1, phone: 1 });

module.exports = mongoose.model("User", userSchema);
