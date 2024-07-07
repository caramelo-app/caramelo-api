function setCutoffDate(weeks) {

    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - (weeks * 7));
    cutoffDate.setUTCHours(0, 0, 0, 0);

    return cutoffDate;
};

module.exports = {
    setCutoffDate
};