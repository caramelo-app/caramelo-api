const mongoose = require("mongoose");
const statusConsts = require("../constants/status.constants");
const { validateDocument } = require("../utils/validation.utils");

const companySchema = new mongoose.Schema({
    name: {
        required: true,
        type: String
    },
    address: {
        street: {
            required: true,
            type: String
        },
        number: {
            required: true,
            type: Number
        },
        complement: {
            type: String
        },
        neighborhood: {
            required: true,
            type: String
        },
        city: {
            required: true,
            type: String
        },
        state: {
            required: true,
            type: String
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },
            coordinates: {
                type: [Number], // [ <longitude>, <latitude> ]
                required: true
            }
        }
    },
    status: {
        required: true,
        type: String,
        enum: Object.values(statusConsts.RESOURCE_STATUS)
    },
    document: {
        required: true,
        type: String,
        unique: true,
        validate: {
            validator: function (v) {
                return validateDocument(v);
            },
            message: props => `Document ${props.value} é inválido`
        },
    },
    excluded: {
        required: true,
        type: Boolean
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null
    },
})

module.exports = mongoose.model("Company", companySchema);