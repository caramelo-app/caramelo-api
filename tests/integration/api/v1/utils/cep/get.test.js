const orchestrator = require("tests/orchestrator.js");

const { localize } = require("utils/localization.utils");

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/utils/cep`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
});

describe("GET CEP Endpoint", () => {
  describe("Anonymous user", () => {
    test("Valid CEP returns address data with location", async () => {
      const validCEP = "01001000";
      const response = await fetch(`${endpoint}?cep=${validCEP}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          updated_at: expect.any(String),
          cep: validCEP,
          city: expect.any(String),
          neighborhood: expect.any(String),
          state: expect.any(String),
          street: expect.any(String),
          service: expect.any(String),
        }),
      );
    });

    test("Invalid CEP returns error", async () => {
      const invalidCEP = "00000000";
      const response = await fetch(`${endpoint}?cep=${invalidCEP}`);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ServiceError",
          action: localize("error.utils.cep.action"),
          status_code: 503,
          message: expect.any(String),
        }),
      );
    });

    test("Missing CEP parameter returns error", async () => {
      const response = await fetch(endpoint);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "CEP",
          }),
        }),
      );
    });
  });
});
