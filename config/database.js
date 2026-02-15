// src/config/database.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Railway PostgreSQL
  },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
