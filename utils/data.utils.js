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
    allowLeadingZeros: false,
  });
}

function ObjectId(objectId) {
  return new mongoose.Types.ObjectId(objectId);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const dataUtils = {
  generatePhoneNumber,
  generateCNPJ,
  ObjectId,
  haversineKm,
};

module.exports = dataUtils;
