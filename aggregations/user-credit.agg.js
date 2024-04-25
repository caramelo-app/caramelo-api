exports.listUserCreditFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};

exports.readUserCreditFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};