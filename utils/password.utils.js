const bcrypt = require("bcryptjs");

async function hash(password) {
  if (password == undefined) {
    throw new Error("Password is undefined");
  }
  const rounds = getNumberOfRounds();
  return await bcrypt.hash(addPepper(password), rounds);
}

async function compare(providedPassword, storedPassword) {
  return await bcrypt.compare(addPepper(providedPassword), storedPassword);
}

function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

function addPepper(password) {
  return password + process.env.PASSWORD_PEPPER;
}

module.exports = {
  hash,
  compare,
};
