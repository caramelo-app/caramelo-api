const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const localeData = require("dayjs/plugin/localeData");
const localizedFormat = require("dayjs/plugin/localizedFormat");

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(localizedFormat);

function formatDate({ date, format }) {
  if (!date) {
    throw new Error("The 'date' parameter is required.");
  }

  const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  dayjs.locale(userLocale);

  const parsedDate = dayjs(date);

  if (!parsedDate.isValid()) {
    throw new Error("Invalid date provided.");
  }

  // Define default format based on locale
  const defaultFormat = format || dayjs().localeData().longDateFormat("L");

  return parsedDate.utc().format(defaultFormat);
}

function addTime(date, time, unit = "minutes") {
  if (!date) {
    throw new Error("The 'date' parameter is required.");
  }

  if (!time) {
    throw new Error("The 'time' parameter is required.");
  }

  return dayjs(date).add(time, unit).toDate();
}

function subTime(date, time, unit = "minutes") {
  if (!date) {
    throw new Error("The 'date' parameter is required.");
  }

  if (!time) {
    throw new Error("The 'time' parameter is required.");
  }

  return dayjs(date).subtract(time, unit).toDate();
}

module.exports = { formatDate, addTime, subTime };
