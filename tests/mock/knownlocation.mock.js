const { fakerPT_BR: faker } = require("@faker-js/faker");

function createDummyKnownLocation(options) {
  return {
    address: {
      street: options?.street || faker.location.streetAddress(),
      number: options?.number || faker.location.buildingNumber(),
      complement: options?.complement || faker.location.secondaryAddress(),
      neighborhood: options?.neighborhood || faker.person.firstName(),
      zipcode: options?.zipcode || faker.location.zipCode().replace("-", ""),
      city: options?.city || faker.location.city(),
      state: options?.state || faker.location.state(),
      location: {
        type: "Point",
        coordinates: [options?.longitude || faker.location.longitude(), options?.latitude || faker.location.latitude()],
      },
    },
  };
}

module.exports = createDummyKnownLocation;
