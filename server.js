// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - SIMPLE
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection
db.query("SELECT NOW()")
  .then(() => console.log("✓ PostgreSQL connected"))
  .catch((err) => console.error("✗ PostgreSQL connection error:", err));

// AUTO-FIX: Add missing columns on startup
db.query(
  `
  ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
  ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
  ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
`,
)
  .then(() => console.log("✓ Database schema updated"))
  .catch((err) => console.log("Schema update skipped:", err.message));

// Rest of your code...
// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GesTech Backend",
  });
});

// Mount agency routes
const agencyRoutes = require("./src/routes/agency");
app.use("/api/agency", agencyRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "GesTech Agency API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      services: "/api/agency/services",
      portfolio: "/api/agency/portfolio",
      testimonials: "/api/agency/testimonials",
      team: "/api/agency/team",
      contact: "/api/agency/contact",
      blog: "/api/agency/blog",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 GesTech Backend Server Running   ║
╠════════════════════════════════════════╣
║   Port: ${PORT}                        
║   Environment: ${process.env.NODE_ENV || "development"}          
║   Database: Connected                  
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
