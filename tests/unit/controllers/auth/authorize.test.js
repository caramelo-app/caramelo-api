const orchestrator = require("tests/orchestrator.js");
const roleConstants = require("constants/roles.constants");
const { requireRole } = require("infra/middleware/auth.middleware");

const { ForbiddenError } = require("infra/errors");

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
});

describe("Authorize (requireRole)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: {
        role: roleConstants.USER_ROLES.CONSUMER,
      },
    };
    res = {};
    next = jest.fn(); // eslint-disable-line
  });

  test("Should call next() when user role is authorized", () => {
    const authorize = requireRole(["consumer", "admin"]);

    authorize(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test("Should throw ForbiddenError when user role is not authorized", () => {
    const authorize = requireRole(["client"]);

    authorize(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  test("Should throw ForbiddenError when user role is not in permissions array", () => {
    req.user.role = "client";
    const authorize = requireRole(["consumer", "admin"]);

    authorize(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
