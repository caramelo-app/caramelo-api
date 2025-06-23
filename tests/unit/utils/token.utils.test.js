require("dotenv").config();

const { generateToken, validateToken } = require("utils/token.utils");

describe("Token Utils", () => {
  describe("generateToken", () => {
    test("Should generate a token correctly", () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(parseInt(process.env.RECOVERY_TOKEN_LENGTH));
      expect(validateToken(token)).toBe(true);
      expect(typeof token).toBe("string");
    });
  });

  describe("validateToken", () => {
    test("Should validate a token correctly", () => {
      const token = generateToken();
      expect(validateToken(token)).toBe(true);
    });

    test("Should return false if the token is not valid", () => {
      const token = "1";
      expect(validateToken(token)).toBe(false);
    });

    test("Should return false if the token is not a string", () => {
      const token = 123456;
      expect(validateToken(token)).toBe(false);
    });
  });
});
