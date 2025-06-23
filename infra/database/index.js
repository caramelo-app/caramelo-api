const mongoose = require("mongoose");

const { ServiceError } = require("../errors");

async function connectDatabase() {
  try {
    const database = process.env.DATABASE_URL;

    await mongoose.connect(database);

    console.log("🟢 Connected to MongoDB successfully");
    console.log("📂 Connected DB name:", mongoose.connection.name);
  } catch (error) {
    throw new ServiceError({
      cause: error,
      message: "Error connecting to MongoDB",
    });
  }
}

async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    await mongoose.connection.close();
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
  }
}

async function clearDatabase() {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error("Error clearing database:", error);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  connectDatabase,
  disconnectDatabase,
  clearDatabase,
};
