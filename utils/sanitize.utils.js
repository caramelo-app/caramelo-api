function sanitizePhone(phone) {

    // We need to sanitize the phone number to get only the numbers
    // And if there's no 55 in the beginning and theres only 9 numbers, we need to add 55 at the beginning
    phone = phone.replace(/\D/g, "");

    if (phone.length === 11) {
        phone = "55" + phone;
    }

    return phone;
};

module.exports = {
    sanitizePhone
};