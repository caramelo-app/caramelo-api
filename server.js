const app = require("./app");

const port = process.env.SERVER_PORT || 3000;

const server = app.listen(port, () => {
  console.log(`🟢 Server is running on port ${port}`);
});

process.on("SIGINT", () => {
  console.log("🟡 Shutting down gracefully...");
  server.close(() => {
    console.log("🔴 Server closed");
    process.exit(0);
  });
});

module.exports = server;

