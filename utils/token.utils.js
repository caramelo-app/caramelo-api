const crypto = require("crypto");

function generateToken() {
  const length = parseInt(process.env.RECOVERY_TOKEN_LENGTH) || 5;

  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  return crypto.randomInt(min, max + 1).toString();
}

function validateToken(token) {
  const expectedLength = parseInt(process.env.RECOVERY_TOKEN_LENGTH) || 5;

  return /^\d+$/.test(token) && token.length === expectedLength;
}

function isTokenExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = {
  generateToken,
  validateToken,
  isTokenExpired,
};
