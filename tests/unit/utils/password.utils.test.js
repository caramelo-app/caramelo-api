const { hash, compare } = require("utils/password.utils");

describe("Password Utils", () => {
  describe("hash", () => {
    test("Should return a hashed password different from the original", async () => {
      const password = "password123";
      const hashedPassword = await hash(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
    });

    test("Should throw an error when password is undefined", async () => {
      await expect(hash(undefined)).rejects.toThrow("Password is undefined");
    });

    test("Should generate different hashes for the same password", async () => {
      const password = "password123";
      const hash1 = await hash(password);
      const hash2 = await hash(password);

      expect(hash1).not.toBe(hash2); // bcrypt generates different hashes due to salt
    });
  });

  describe("compare", () => {
    test("Should return true when comparing a password with its hash", async () => {
      const password = "password123";
      const hashedPassword = await hash(password);

      const isMatch = await compare(password, hashedPassword);
      expect(isMatch).toBe(true);
    });

    test("Should return false when comparing a wrong password with a hash", async () => {
      const password = "password123";
      const wrongPassword = "wrongpassword";
      const hashedPassword = await hash(password);

      const isMatch = await compare(wrongPassword, hashedPassword);
      expect(isMatch).toBe(false);
    });

    test("Should handle pepper correctly", async () => {
      const password = "password123";
      const hashedPassword = await hash(password);

      // Should match with correct password
      const isMatch = await compare(password, hashedPassword);
      expect(isMatch).toBe(true);

      // Should not match if pepper is different
      process.env.PASSWORD_PEPPER = "different_pepper";
      const isMatchWithDifferentPepper = await compare(password, hashedPassword);
      expect(isMatchWithDifferentPepper).toBe(false);
    });
  });
});
