const orchestrator = require("tests/orchestrator.js");

const { localize } = require("utils/localization.utils");

beforeAll(async () => {
  await orchestrator.startLocalization();
});

describe("Localization Utils", () => {
  describe("localize", () => {
    test("Should localize a valid key correctly with a given format", () => {
      const key = "test.key";
      const params = { name: "John" };
      const result = localize(key, params);
      expect(result).toBe("Hello, John!");
    });
  });
});
