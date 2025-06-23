const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const localeData = require("dayjs/plugin/localeData");
const localizedFormat = require("dayjs/plugin/localizedFormat");

const { generatePhoneNumber, generateCNPJ } = require("utils/data.utils");

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(localizedFormat);

describe("Data Utils", () => {
  describe("generatePhoneNumber", () => {
    test("Should generate a valid phone number", () => {
      const phoneNumber = generatePhoneNumber();
      expect(phoneNumber).toBeDefined();
      expect(phoneNumber).toMatch(/^\d{13}$/);
      expect(phoneNumber.length).toBe(13);
      expect(phoneNumber).toMatch(/^55\d{11}$/);
    });
  });

  describe("generateCNPJ", () => {
    test("Should generate a valid CNPJ", () => {
      const cnpj = generateCNPJ();
      expect(cnpj).toBeDefined();
      expect(cnpj).toMatch(/^\d{14}$/);
      expect(cnpj.length).toBe(14);
      expect(cnpj[0]).not.toBe("0");
    });
  });
});
