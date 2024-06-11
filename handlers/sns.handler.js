const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const methods = module.exports = {};

/**
 * Sends an SMS message using Amazon Simple Notification Service (SNS).
 * This method handles setup and sending of the SMS, including configuration of message attributes like SMS type.
 * @param {Object} options - Contains all the necessary information to send an SMS.
 * @param {string} options.message - The message body of the SMS.
 * @param {string} options.phoneNumber - The recipient's phone number in E.164 format.
 * @param {string} [options.smsType="Transactional"] - The type of SMS to be sent; can be "Transactional" or "Promotional".
 * @param {Function} callback - Callback function to handle the response or error after attempting to send the SMS.
 * @param {Error} callback.error - Error object if an error occurs.
 * @param {string} callback.result - Success message if the SMS is sent successfully.
 */
methods.sendSMS = async (options, callback) => {

    const sns = new SNSClient({
        region: process.env.AWS_REGION
    });

    if (!options.message) {
        return callback(new Error("Mensagem não informada"));
    }

    if (!options.phoneNumber) {
        return callback(new Error("Número de telefone não informado"));
    }

    if (!options.smsType) {
        options.smsType = "Transactional";
    }

    // If the number starts with 55, we need to keep them like it is
    // Otherwise, we need to insert it
    if (options.phoneNumber.startsWith("55")) {
        options.phoneNumber = options.phoneNumber.replace("+", "");
    }

    const params = {
        Message: options.message,
        PhoneNumber: options.phoneNumber,
        MessageAttributes: {
            "AWS.SNS.SMS.SMSType": {
                DataType: "String",
                StringValue: options.smsType // "Transactional" or "Promotional"
            }
        }
    };

    try {
        const data = await sns.send(new PublishCommand(params));
        console.log("SMS enviado com sucesso:", data);
        return callback(null, "SMS enviado com sucesso");
    }
    catch (err) {
        console.error("Erro ao enviar SMS:", err);
        return callback(err);
    }
};

module.exports = methods;