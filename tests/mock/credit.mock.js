const mongoose = require("mongoose");

const statusConsts = require("../../constants/status.constants");

function createDummyCredit(options) {
  return {
    user_id: options?.user_id || new mongoose.Types.ObjectId(),
    card_id: options?.card_id || new mongoose.Types.ObjectId(),
    company_id: options?.company_id || new mongoose.Types.ObjectId(),
    status: options?.status || statusConsts.CREDITS_STATUS.AVAILABLE,
    excluded: options?.excluded || false,
    requested_at: options?.requested_at || null,
    expires_at: options?.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  };
}

module.exports = createDummyCredit;
