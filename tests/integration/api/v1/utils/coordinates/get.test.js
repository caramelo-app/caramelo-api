const orchestrator = require("tests/orchestrator.js");

const { localize } = require("utils/localization.utils");
const { connectDatabase, disconnectDatabase } = require("infra/database");

const endpoint = `${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/api/v1/utils/coordinates`;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
  await connectDatabase();
});

afterAll(async () => {
  await orchestrator.clearDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

describe("GET /api/v1/utils/coordinates", () => {
  describe("Anonymous user", () => {
    test("Valid parameters return coordinates data without cache", async () => {
      // Use a unique address for each test run to avoid cache issues
      const queryString = `street=Rua da Consolação&neighborhood=Consolação&city=São Paulo&state=SP&zipcode=01302-907&number=100`;

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          address: expect.any(String),
          latitude: expect.any(Number),
          longitude: expect.any(Number),
          cached: false,
        }),
      );

      // Verify the address format
      expect(body.address).toContain(`Rua da Consolação`);
      expect(body.address).toContain(`100`);
      expect(body.address).toContain("Consolação");
      expect(body.address).toContain("São Paulo");
      expect(body.address).toContain("SP");
      expect(body.address).toContain("01302-907");
    });

    test("Missing street parameter returns validation error", async () => {
      const queryString = "neighborhood=Consolação&city=São Paulo&state=SP&zipcode=01302-907&number=1500";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "street",
          }),
        }),
      );
    });

    test("Missing neighborhood parameter returns validation error", async () => {
      const queryString = "street=Rua da Consolação&city=São Paulo&state=SP&zipcode=01302-907&number=1500";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "neighborhood",
          }),
        }),
      );
    });

    test("Missing city parameter returns validation error", async () => {
      const queryString = "street=Rua da Consolação&neighborhood=Consolação&state=SP&zipcode=01302-907&number=1500";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "city",
          }),
        }),
      );
    });

    test("Missing state parameter returns validation error", async () => {
      const queryString =
        "street=Rua da Consolação&neighborhood=Consolação&city=São Paulo&zipcode=01302-907&number=1500";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "state",
          }),
        }),
      );
    });

    test("Missing zipcode parameter returns validation error", async () => {
      const queryString = "street=Rua da Consolação&neighborhood=Consolação&city=São Paulo&state=SP&number=1500";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "zipcode",
          }),
        }),
      );
    });

    test("Missing number parameter returns validation error", async () => {
      const queryString = "street=Rua da Consolação&neighborhood=Consolação&city=São Paulo&state=SP&zipcode=01302-907";

      const response = await fetch(`${endpoint}?${queryString}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          name: "ValidationError",
          action: localize("error.ValidationError.action"),
          status_code: 400,
          message: localize("error.generic.required", {
            field: "number",
          }),
        }),
      );
    });

    // Cache test - run last to avoid interference with other tests
    test("Valid parameters return coordinates data with cache on second call", async () => {
      const queryString = `street=Rua da Consolação&neighborhood=Consolação&city=São Paulo&state=SP&zipcode=01302-907&number=100`;

      // First call - should create cache entry with cached: false
      const firstResponse = await fetch(`${endpoint}?${queryString}`);
      const firstBody = await firstResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(firstBody.cached).toBe(false); // First call creates the cache

      // Second call - should use cache with cached: true
      const secondResponse = await fetch(`${endpoint}?${queryString}`);
      const secondBody = await secondResponse.json();
      expect(secondResponse.status).toBe(200);
      expect(secondBody).toEqual(
        expect.objectContaining({
          address: expect.any(String),
          latitude: expect.any(Number),
          longitude: expect.any(Number),
          cached: true, // Second call should use cache
        }),
      );

      // Coordinates should be the same between calls
      expect(secondBody.latitude).toBe(firstBody.latitude);
      expect(secondBody.longitude).toBe(firstBody.longitude);
    });
  });
});
