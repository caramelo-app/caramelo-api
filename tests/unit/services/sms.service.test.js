require("dotenv").config();

const smsService = require("services/sms.service");
const smsTemplates = require("templates/sms.templates");

const dataUtils = require("utils/data.utils");
const { localize } = require("utils/localization.utils");

describe("SMS Services", () => {
  describe("sendSms", () => {
    test("Should send the sms successfully", async () => {
      const smsOptions = {
        phone: dataUtils.generatePhoneNumber(),
        content: smsTemplates.sendToken("123456"),
      };

      const { err } = await smsService.sendSms(smsOptions);

      expect(err).toBeNull();
    });

    test("Should return an error when the phone is missing", async () => {
      const smsOptions = {
        content: smsTemplates.sendToken("123456"),
      };

      const { err } = await smsService.sendSms(smsOptions);

      expect(err).toBeDefined();
      expect(err.message).toBe(localize("error.generic.required", { field: "phone" }));
    });

    test("Should return an error when the content is missing", async () => {
      const smsOptions = {
        phone: dataUtils.generatePhoneNumber(),
      };

      const { err } = await smsService.sendSms(smsOptions);

      expect(err).toBeDefined();
      expect(err.message).toBe(localize("error.generic.required", { field: "content" }));
    });

    test("Should return an error when the provider is not valid", async () => {
      const smsOptions = {
        phone: dataUtils.generatePhoneNumber(),
        content: smsTemplates.sendToken("123456"),
        provider: "fake",
      };

      const { err } = await smsService.sendSms(smsOptions);

      expect(err).toBeDefined();
      expect(err.message).toBe(localize("error.generic.required", { field: "SMS Provider" }));
    });
  });
});
