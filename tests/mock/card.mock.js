const mongoose = require("mongoose");

const statusConsts = require("../../constants/status.constants");
const datesConstants = require("../../constants/dates.constants");

const { fakerPT_BR: faker } = require("@faker-js/faker");

function createDummyCard(options) {
  return {
    title: options?.title || faker.lorem.sentence(),
    company_id: options?.company_id || new mongoose.Types.ObjectId(),
    credits_needed: options?.credits_needed || faker.number.int(10),
    credit_expires_at: options?.credit_expires_at || {
      ref_number: options?.credit_expires_at?.ref_number || faker.number.int({ min: 1, max: 12 }),
      ref_type: options?.credit_expires_at?.ref_type || datesConstants.TYPES.MONTH,
    },
    status: options?.status || statusConsts.RESOURCE_STATUS.PENDING,
    excluded: options?.excluded || false,
  };
}

module.exports = createDummyCard;
