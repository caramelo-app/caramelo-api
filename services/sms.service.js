const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const { localize } = require("../utils/localization.utils");
const { ValidationError, ServiceError } = require("../infra/errors");

async function sendSms(options) {
  const { phone, content, provider = process.env.SMS_PROVIDER } = options;

  if (!phone) {
    return {
      err: new ValidationError({
        message: localize("error.generic.required", { field: "phone" }),
      }),
    };
  }

  if (!content) {
    return {
      err: new ValidationError({
        message: localize("error.generic.required", { field: "content" }),
      }),
    };
  }

  // Select the provider
  switch (provider) {
    case "AWS_SNS":
      return sendSmsWithAWS(options);
    default:
      return {
        err: new ServiceError({
          message: localize("error.generic.required", { field: "SMS Provider" }),
        }),
      };
  }
}

async function sendSmsWithAWS(options) {
  const { phone, content } = options;
  try {
    if (process.env.SMS_DRY_MODE === "false") {
      const sns = await new SNSClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const params = {
        Message: content,
        PhoneNumber: phone,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      };

      await sns.send(new PublishCommand(params));
    }

    return {
      err: null,
    };
  } catch (err) {
    return {
      err,
    };
  }
}

module.exports = {
  sendSms,
};
