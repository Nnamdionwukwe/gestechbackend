// src/config/redis.js
const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true, // Required for Railway Redis
    rejectUnauthorized: false,
  },
});

client.on("error", (err) => console.error("Redis Client Error", err));
client.on("connect", () => console.log("✓ Redis connected"));

// Connect
client.connect().catch(console.error);

module.exports = client;
