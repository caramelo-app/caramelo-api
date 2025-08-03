const { rateLimit } = require("express-rate-limit");
const { slowDown } = require("express-slow-down");
const { localize } = require("../../utils/localization.utils");

// Function to log rate limiting (optional - for monitoring)
const logRateLimit = (req, rateLimitType) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`🚦 Rate limit hit: ${rateLimitType} - IP: ${req.ip} - User: ${req.user?._id || "anonymous"}`);
  }
};

// Function to skip rate limiting during tests
const skipDuringTests = () => process.env.NODE_ENV === "test";

// Global rate limiting for all requests
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 200, // 100 requests per 15 min in production
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    return req.ip;
  },
  message: {
    name: "TooManyRequestsError",
    message: localize("error.rateLimiting.global.message"),
    action: localize("error.rateLimiting.global.action"),
    status_code: 429,
  },
  handler: (req, res) => {
    logRateLimit(req, "global");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.global.message"),
      action: localize("error.rateLimiting.global.action"),
      status_code: 429,
    });
  },
});

// Global slow down for all requests
const globalSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // After 50 requests
  delayMs: (hits) => (hits - 50) * 100, // 100ms, 200ms, 300ms...
  maxDelayMs: 5000, // Maximum 5 seconds of delay
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    return req.ip;
  },
});

// Rate limiting for authentication (more restrictive)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 10, // Maximum 5 attempts in production
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    // Combine IP + phone for rate limiting by user
    const identifier = req.body?.phone || "unknown";
    return `${req.ip}:${identifier}`;
  },
  message: {
    name: "TooManyRequestsError",
    message: localize("error.rateLimiting.auth.message"),
    action: localize("error.rateLimiting.auth.action"),
    status_code: 429,
  },
  handler: (req, res) => {
    logRateLimit(req, "auth");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.auth.message"),
      action: localize("error.rateLimiting.auth.action"),
      status_code: 429,
    });
  },
});

// Rate limiting for account creation (very restrictive)
const createAccountRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 5, // Maximum 3 accounts per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    // Rate limiting by IP + phone
    return `${req.ip}:${req.body?.phone || "unknown"}`;
  },
  handler: (req, res) => {
    logRateLimit(req, "createAccount");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.createAccount.message"),
      action: localize("error.rateLimiting.createAccount.action"),
      status_code: 429,
    });
  },
});

// Rate limiting for password reset (restrictive)
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 5, // Maximum 3 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    return `${req.ip}:${req.body?.phone || "unknown"}`;
  },
  handler: (req, res) => {
    logRateLimit(req, "passwordReset");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.passwordReset.message"),
      action: localize("error.rateLimiting.passwordReset.action"),
      status_code: 429,
    });
  },
});

// Rate limiting for credit operations (moderate)
const creditOperationsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === "production" ? 10 : 20, // Maximum 10 operations per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    // Rate limiting by authenticated user
    return `user:${req.user?._id || req.ip}`;
  },
  handler: (req, res) => {
    logRateLimit(req, "creditOperations");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.creditOperations.message"),
      action: localize("error.rateLimiting.creditOperations.action"),
      status_code: 429,
    });
  },
});

// Slow down for authentication operations
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 3, // After 3 attempts
  delayMs: (hits) => (hits - 3) * 500, // 500ms, 1s, 1.5s...
  maxDelayMs: 10000, // Maximum 10 seconds of delay
  skip: skipDuringTests, // Skip during tests
  keyGenerator: (req) => {
    const identifier = req.body?.phone || "unknown";
    return `${req.ip}:${identifier}`;
  },
});

// Rate limiting for authenticated users (more permissive)
const authenticatedUserRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === "production" ? 50 : 100, // 50 requests per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip during tests OR if user is not authenticated
    return skipDuringTests() || !req.user;
  },
  keyGenerator: (req) => {
    return `user:${req.user?._id}`;
  },
  handler: (req, res) => {
    logRateLimit(req, "authenticatedUser");
    res.status(429).json({
      name: "TooManyRequestsError",
      message: localize("error.rateLimiting.authenticatedUser.message"),
      action: localize("error.rateLimiting.authenticatedUser.action"),
      status_code: 429,
    });
  },
});

module.exports = {
  authRateLimit,
  createAccountRateLimit,
  passwordResetRateLimit,
  creditOperationsRateLimit,
  authSlowDown,
  authenticatedUserRateLimit,
  globalRateLimit,
  globalSlowDown,
};
