const mongoose = require("mongoose");

const statusConsts = require("constants/status.constants");

const { fakerPT_BR: faker } = require("@faker-js/faker");
const { generateCNPJ } = require("utils/data.utils");

function createDummyCompany(options) {
  return {
    name: options?.name || faker.company.name(),
    address: options?.address || {
      street: faker.location.streetAddress(),
      number: faker.location.buildingNumber(),
      complement: faker.location.secondaryAddress(),
      neighborhood: faker.person.firstName(),
      city: faker.location.city(),
      state: faker.location.state(),
      location: {
        type: "Point",
        coordinates: [faker.location.longitude(), faker.location.latitude()],
      },
    },
    logo: options?.logo || "https://via.placeholder.com/150",
    segment: options?.segment || {
      _id: new mongoose.Types.ObjectId(),
      name: faker.company.name(),
      icon: "https://via.placeholder.com/150",
      description: faker.lorem.sentence(),
      status: statusConsts.RESOURCE_STATUS.AVAILABLE,
      excluded: false,
    },
    status: options?.status || statusConsts.RESOURCE_STATUS.PENDING,
    document: options?.document || generateCNPJ(),
    excluded: options?.excluded || false,
  };
}

module.exports = createDummyCompany;
