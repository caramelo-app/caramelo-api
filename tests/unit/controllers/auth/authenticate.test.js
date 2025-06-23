const jwt = require("jsonwebtoken");

const orchestrator = require("tests/orchestrator.js");
const { authenticate } = require("infra/middleware/auth.middleware");

const { UnauthorizedError } = require("infra/errors");

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.startLocalization();
});

describe("Authenticate", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      user: {},
    };
    res = {};
    next = jest.fn(); // eslint-disable-line
  });

  test("Should throw UnauthorizedError when no token is provided", () => {
    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  test("Should throw UnauthorizedError when token is invalid", () => {
    req.headers["authorization"] = "Bearer invalid-token";

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  test("Should set user data when token is valid", () => {
    const decoded = {
      _id: "123",
      role: "consumer",
    };

    const token = jwt.sign(decoded, process.env.JWT_SECRET, {
      expiresIn: process.env.LOGIN_EXPIRES_IN,
    });

    req.headers["authorization"] = `Bearer ${token}`;

    authenticate(req, res, next);

    expect(req.user).toEqual({
      _id: decoded._id,
      role: decoded.role,
    });
    expect(next).toHaveBeenCalledWith();
  });
});
