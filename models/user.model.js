const mongoose = require("mongoose");
const statusConsts = require("../constants/status.constants");
const roleConstants = require("../constants/roles.constants");
const { validateEmail, validatePhone } = require("../utils/validation.utils");

const userSchema = new mongoose.Schema({
    name: {
        required: true,
        type: String
    },
    email: {
        required: function () {
            return this.role === roleConstants.USER_ROLES.CLIENT;
        },
        type: String,
        unique: true,
        validate: {
            validator: function (v) {
                return validateEmail(v);
            },
            message: props => `Email ${props.value} é inválido`
        }
    },
    phone: {
        required: function () {
            return this.role === roleConstants.USER_ROLES.CONSUMER;
        },
        type: String,
        unique: true,
        validate: {
            validator: function (v) {
                return validatePhone(v);
            },
            message: props => `Phone ${props.value} é inválido`
        }
    },
    password: {
        required: true,
        type: String
    },
    address: {
        street: {
            required: function () {
                return this.role === roleConstants.USER_ROLES.CLIENT;
            },
            type: String
        },
        number: {
            required: function () {
                return this.role === roleConstants.USER_ROLES.CLIENT;
            },
            type: Number
        },
        complement: {
            type: String
        },
        neighborhood: {
            required: function () {
                return this.role === roleConstants.USER_ROLES.CLIENT;
            },
            type: String
        },
        city: {
            required: function () {
                return this.role === roleConstants.USER_ROLES.CLIENT;
            },
            type: String
        },
        state: {
            required: function () {
                return this.role === roleConstants.USER_ROLES.CLIENT;
            },
            type: String
        },
    },
    status: {
        required: true,
        type: String,
        enum: Object.values(statusConsts.RESOURCE_STATUS),
        default: statusConsts.RESOURCE_STATUS.PENDING
    },
    role: {
        required: true,
        type: String,
        enum: Object.values(roleConstants.USER_ROLES)
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: false
    },
    excluded: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null
    },
    validation_token: {
        type: String,
        default: null
    },
    validation_token_expires_at: {
        type: Date,
        default: null
    },
});

// Middleware to add '55' phone code to the phone number if it has 11 digits
userSchema.pre('save', function (next) {
    const user = this;
    if (user.isModified('phone')) {
        if (user.phone && user.phone.length === 11) {
            user.phone = '55' + user.phone;
        }
    }
    next();
});

module.exports = mongoose.model("User", userSchema);