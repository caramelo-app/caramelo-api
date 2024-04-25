function validateEmail(v) {
    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(v);
}

function validateDocument(v) {
    return /^[0-9]{11}$|^[0-9]{14}$/.test(v);
}

function validatePhone(v) {
    return /^[0-9]{11}$/.test(v);
}

module.exports = {
    validateEmail,
    validateDocument,
    validatePhone
};