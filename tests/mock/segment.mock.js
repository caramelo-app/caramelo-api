const { fakerPT_BR: faker } = require("@faker-js/faker");
const statusConsts = require("constants/status.constants");

function createDummySegment(options) {
  return {
    name: options?.name || faker.company.name(),
    icon: options?.icon || "https://via.placeholder.com/150",
    description: options?.description || faker.lorem.sentence(),
    status: options?.status || statusConsts.RESOURCE_STATUS.PENDING,
    excluded: options?.excluded || false,
  };
}

module.exports = createDummySegment;
