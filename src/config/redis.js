// src/config/redis.js
const redis = require("redis");

// Determine if we need TLS based on the URL
const isProduction = process.env.NODE_ENV === "production";
const redisUrl = process.env.REDIS_URL;

// Check if URL is internal Railway URL or localhost
const isInternalUrl =
  redisUrl?.includes("railway.internal") || redisUrl?.includes("localhost");

const client = redis.createClient({
  url: redisUrl,
  socket: {
    // Only use TLS for external Railway URLs in production
    tls: isProduction && !isInternalUrl,
    rejectUnauthorized: false,
  },
});

client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

client.on("connect", () => {
  console.log("✓ Redis connected");
});

client.on("ready", () => {
  console.log("✓ Redis ready");
});

// Connect
client.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  // Don't crash the app if Redis fails
  console.log("⚠️  Continuing without Redis cache...");
});

module.exports = client;
