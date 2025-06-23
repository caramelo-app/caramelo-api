const { validateEmail, validateDocument, validatePhone } = require("utils/validation.utils");

describe("Validation Utils", () => {
  describe("validateEmail", () => {
    test("Should return true if the email is valid", () => {
      const email = "test@test.com";
      const result = validateEmail(email);
      expect(result).toBe(true);
    });

    test("Should return false if the email is invalid", () => {
      const email = "test";
      const result = validateEmail(email);
      expect(result).toBe(false);
    });

    test("Should return false if the email is empty", () => {
      const email = "";
      const result = validateEmail(email);
      expect(result).toBe(false);
    });

    test("Should return false if the email is null", () => {
      const email = null;
      const result = validateEmail(email);
      expect(result).toBe(false);
    });

    test("Should return false if the email is undefined", () => {
      const email = undefined;
      const result = validateEmail(email);
      expect(result).toBe(false);
    });

    test("Should return false if the email is not a string", () => {
      const email = 123;
      const result = validateEmail(email);
      expect(result).toBe(false);
    });

    test("Should return false if the email is not a valid email", () => {
      const email = "test@test";
      const result = validateEmail(email);
      expect(result).toBe(false);
    });
  });

  describe("validateDocument", () => {
    test("Should return true if the document is valid CPF", () => {
      const document = "04992271901";
      const result = validateDocument(document);
      expect(result).toBe(true);
    });

    test("Should return true if the document is valid CNPJ", () => {
      const document = "33716749000199";
      const result = validateDocument(document);
      expect(result).toBe(true);
    });

    test("Should return false if the document is invalid", () => {
      const document = "1234567890";
      const result = validateDocument(document);
      expect(result).toBe(false);
    });

    test("Should return false if the document is not a string", () => {
      const document = 123;
      const result = validateDocument(document);
      expect(result).toBe(false);
    });

    test("Should return false if the document is not a valid CPF or CNPJ", () => {
      const document = "55467";
      const result = validateDocument(document);
      expect(result).toBe(false);
    });
  });

  describe("validatePhone", () => {
    test("Should return true if the phone is valid", () => {
      const phone = "5541984012834";
      const result = validatePhone(phone);
      expect(result).toBe(true);
    });

    test("Should return false if the phone is not a string", () => {
      const phone = 123;
      const result = validatePhone(phone);
      expect(result).toBe(false);
    });

    test("Should return false if the phone is not a valid phone number", () => {
      const phone = "554198401283";
      const result = validatePhone(phone);
      expect(result).toBe(false);
    });

    test("Should return false if the phone doesnt contain 13 digits (international code + local code + phone)", () => {
      const phone = "55419840128";
      const result = validatePhone(phone);
      expect(result).toBe(false);
    });
  });
});
