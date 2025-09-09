// testConnection.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function testDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connection successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

testDB();
