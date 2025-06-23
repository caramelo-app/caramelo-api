const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const localeData = require("dayjs/plugin/localeData");
const localizedFormat = require("dayjs/plugin/localizedFormat");

const { formatDate, addTime, subTime } = require("utils/date.utils");

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(localizedFormat);

describe("Date Utils", () => {
  describe("formatDate", () => {
    test("Should format a valid date correctly with a given format", () => {
      const options = { date: "2024-12-30T15:00:00Z", format: "DD/MM/YYYY" };
      const result = formatDate(options);
      expect(result).toBe("30/12/2024");
    });

    test("Should throw an error if no date is provided", () => {
      expect(() => formatDate({})).toThrow("The 'date' parameter is required.");
    });

    test("Should throw an error for an invalid date", () => {
      const options = { date: "invalid-date", format: "DD/MM/YYYY" };
      expect(() => formatDate(options)).toThrow("Invalid date provided.");
    });

    test("Should format a valid date correctly using the default format when no format is provided", () => {
      const options = { date: "2024-12-30T15:00:00Z" };
      const detectedLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      dayjs.locale(detectedLocale);
      const expectedFormat = dayjs(options.date).utc().format(dayjs().localeData().longDateFormat("L"));
      const result = formatDate(options);
      expect(result).toBe(expectedFormat);
    });
  });

  describe("addTime", () => {
    test("Should add time to a date correctly", () => {
      const date = new Date("2024-12-30T15:00:00Z");
      const result = addTime(date, 1, "hour");
      expect(result.toISOString()).toBe(new Date("2024-12-30T16:00:00Z").toISOString());
    });

    test("Should throw an error if no date is provided", () => {
      expect(() => addTime(null, 1, "hour")).toThrow("The 'date' parameter is required.");
    });

    test("Should throw an error if no time is provided", () => {
      expect(() => addTime(new Date(), null, "hour")).toThrow("The 'time' parameter is required.");
    });
  });

  describe("subTime", () => {
    test("Should subtract time from a date correctly", () => {
      const date = new Date("2024-12-30T15:00:00Z");
      const result = subTime(date, 1, "hour");
      expect(result.toISOString()).toBe(new Date("2024-12-30T14:00:00Z").toISOString());
    });

    test("Should throw an error if no date is provided", () => {
      expect(() => subTime(null, 1, "hour")).toThrow("The 'date' parameter is required.");
    });

    test("Should throw an error if no time is provided", () => {
      expect(() => subTime(new Date(), null, "hour")).toThrow("The 'time' parameter is required.");
    });
  });
});
