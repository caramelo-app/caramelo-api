const orchestrator = require("tests/orchestrator.js");

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/health`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("GET Health Endpoint", () => {
  describe("Anonymous user", () => {
    test("Should return 200 status", async () => {
      const response = await fetch(endpoint);

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("mongo");
    });
  });
});
