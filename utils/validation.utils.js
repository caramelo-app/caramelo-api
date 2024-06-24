const validateEmail = function (email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i;
    return re.test(email);
};

function validateDocument(v) {
    return /^[0-9]{11}$|^[0-9]{14}$/.test(v);
}

function validatePhone(v) {
    return /^[0-9]{13}$/.test(v);
}

module.exports = {
    validateEmail,
    validateDocument,
    validatePhone
};