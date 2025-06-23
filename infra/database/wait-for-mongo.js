require("dotenv").config();
const retry = require("async-retry");
const { MongoClient } = require("mongodb");

async function waitForMongo() {
  try {
    await retry(
      async () => {
        const client = new MongoClient(process.env.DATABASE_URL);
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        console.log("🟢 MongoDB is ready!");
      },
      {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 5000,
      },
    );
  } catch (error) {
    console.error("🔴 Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

waitForMongo();
