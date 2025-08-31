const app = require("./app");

const PORT = process.env.SERVER_PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🟢 Server is running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("🟡 Shutting down gracefully...");
  server.close(() => {
    console.log("🔴 Server closed");
    process.exit(0);
  });
});
