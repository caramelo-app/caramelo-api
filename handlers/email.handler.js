const path = require("path");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");

const viewPath = path.resolve(__dirname, "../emails/views");
const partialsPath = path.resolve(__dirname, "../emails/partials");
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
        user: process.env.BREVO_LOGIN,
        pass: process.env.BREVO_PASS,
    },
});

const methods = module.exports = {};

/**
 * Sends an email using predefined templates and SMTP settings. The function uses Handlebars templates for
 * generating email content based on the context provided in the options.
 * @param {Object} options - Contains the mail sending options including sender, recipient, subject, message body, and template details.
 * @param {Function} callback - Callback function to handle the response or error after attempting to send the email.
 */
methods.send = (options, callback) => {

    const mailOptions = {
        from: options.sender.name + "<" + options.sender.email + ">",
        to: options.to.name + "<" + options.to.email + ">",
        subject: options.subject,
        html: options.message,
        template: options.template,
        context: options.body
    };

    transporter.use("compile", hbs({
        viewEngine: {
            extName: ".handlebars",
            layoutsDir: viewPath,
            defaultLayout: false,
            partialsDir: partialsPath
        },
        viewPath: viewPath,
        extName: ".handlebars",
    }))

    transporter.sendMail(mailOptions, function (err, response) {

        if (err) {
            return callback(err)
        }

        return callback(null, response);
    });

};

module.exports = methods;