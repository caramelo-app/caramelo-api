const mongoose = require("mongoose");
const statusConsts = require("../constants/status.constants");

const userCreditsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    card: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CompanyCard",
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    status: {
        required: true,
        type: String,
        enum: Object.values(statusConsts.CREDITS_STATUS)
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
    requested_at: {
        type: Date,
        default: null
    },
})

module.exports = mongoose.model("UserCredits", userCreditsSchema);