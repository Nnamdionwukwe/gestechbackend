// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE - ORDER IS CRITICAL!
// ========================================

// 1. CORS - MUST BE FIRST!
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5000",
        "https://gestechbackend-production.up.railway.app",
      ];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins in development
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// 2. Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 3. Logging (optional)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ========================================
// TEST DATABASE CONNECTION
// ========================================
db.query("SELECT NOW()")
  .then(() => console.log("✓ PostgreSQL connected"))
  .catch((err) => console.error("✗ PostgreSQL connection error:", err));

// ========================================
// ROUTES
// ========================================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GesTech Backend",
    port: PORT,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "GesTech Agency API",
    version: "1.0.0",
    status: "running",
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

// Mount agency routes
const agencyRoutes = require("./src/routes/agency");
app.use("/api/agency", agencyRoutes);

// ========================================
// ERROR HANDLERS
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    path: req.path,
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 GesTech Backend Server Running   ║
╠════════════════════════════════════════╣
║   Port: ${PORT}                        
║   Environment: ${process.env.NODE_ENV || "development"}          
║   Database: Connected                  
║                                        
║   🔗 Test URLs:                        
║   Health: http://localhost:${PORT}/health
║   API: http://localhost:${PORT}/api/agency/services
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("📴 SIGTERM signal received: closing server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📴 SIGINT signal received: closing server");
  process.exit(0);
});

module.exports = app;
