exports.listCompanyCardFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};

exports.readCompanyCardFullData = (options) => {

    return [
        {
            $match: options.filter
        }
    ];
};