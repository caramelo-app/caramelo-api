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

function processWeeklyStats(items, uniqueField = null, dateField = "created_at") {
  try {
    // Validation: return empty structure if invalid data
    if (!Array.isArray(items) || items.length === 0) {
      return createEmptyWeeklyStats();
    }

    // Check if data has expected structure
    const firstItem = items[0];
    if (!firstItem || (!firstItem[uniqueField] && !firstItem._id && !uniqueField) || !firstItem[dateField]) {
      return createEmptyWeeklyStats();
    }

    // Map _id to uniqueField if necessary (for aggregation results)
    let processedItems = items;
    if (uniqueField && !firstItem[uniqueField] && firstItem._id) {
      processedItems = items.map((item) => ({
        ...item,
        [uniqueField]: item[uniqueField] || item._id,
      }));
    }

    const weeks = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7 - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekLabel = `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;

      const weekItems = processedItems.filter((item) => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= weekStart && itemDate <= weekEnd;
      });

      let count;
      if (uniqueField) {
        const uniqueItems = [...new Set(weekItems.map((item) => item[uniqueField]?.toString()).filter(Boolean))];
        count = uniqueItems.length;
      } else {
        count = weekItems.length;
      }

      weeks.push({
        week: weekLabel,
        count: count,
      });
    }

    return weeks;
  } catch (error) {
    console.error("Error in processWeeklyStats:", error);
    return createEmptyWeeklyStats();
  }
}

function createEmptyWeeklyStats() {
  const weeks = [];
  const now = new Date();

  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7 - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekLabel = `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;

    weeks.push({
      week: weekLabel,
      count: 0,
    });
  }

  return weeks;
}

module.exports = { formatDate, addTime, subTime, processWeeklyStats };
