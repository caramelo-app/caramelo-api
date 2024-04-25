const mongoose = require("mongoose");
const statusConsts = require("../constants/status.constants");
const datesConstants = require("../constants/dates.constants");

const companyCardSchema = new mongoose.Schema({
    title: {
        required: true,
        type: String
    },
    company: {
        required: true,
        ref: "Company",
        type: mongoose.Schema.Types.ObjectId
    },
    credits: {
        required: true,
        type: Number
    },
    credit_expires_at: {
        ref_number: {
            required: true,
            type: Number
        },
        ref_type: {
            required: true,
            type: String,
            enum: Object.values(datesConstants.TYPES)
        }
    },
    status: {
        required: true,
        type: String,
        enum: Object.values(statusConsts.RESOURCE_STATUS)
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

module.exports = mongoose.model("CompanyCard", companyCardSchema);