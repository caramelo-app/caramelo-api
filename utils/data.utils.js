const mongoose = require("mongoose");
const { fakerPT_BR: faker } = require("@faker-js/faker");

function generatePhoneNumber() {
  const ddd = faker.string.numeric({
    length: 2,
    allowLeadingZeros: false,
  });
  const lineNumber = faker.string.numeric({
    length: 8,
  });
  return `55${ddd}9${lineNumber}`;
}

function generateCNPJ() {
  return faker.string.numeric({
    length: 14,
    allowLeadingZeros: true,
  });
}

function ObjectId(objectId) {
  return new mongoose.Types.ObjectId(objectId);
}

const dataUtils = {
  generatePhoneNumber,
  generateCNPJ,
  ObjectId,
};

module.exports = dataUtils;
