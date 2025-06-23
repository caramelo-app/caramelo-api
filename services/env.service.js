function envCheck() {
  const requiredEnvVars = [
    "JWT_SECRET",
    "DATABASE_URL",
    "PASSWORD_PEPPER",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ];

  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  });
}

module.exports = {
  envCheck,
};
