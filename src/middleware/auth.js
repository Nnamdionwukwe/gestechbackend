// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// ==================== AUTHENTICATE USER ====================

exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Check if user exists and is active
    const user = await db.query(
      "SELECT id, email, full_name, role, is_active FROM users WHERE id = $1",
      [decoded.id],
    );

    if (user.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    if (!user.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: "Account is inactive",
      });
    }

    // Attach user to request
    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

// ==================== AUTHORIZE ROLE ====================

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this resource",
      });
    }

    next();
  };
};

// ==================== OPTIONAL AUTHENTICATION ====================

exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // No token, continue without user
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await db.query(
        "SELECT id, email, full_name, role, is_active FROM users WHERE id = $1 AND is_active = true",
        [decoded.id],
      );

      if (user.rows.length > 0) {
        req.user = user.rows[0];
      }
    } catch (err) {
      // Invalid token, but continue without user
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    next(); // Continue without user on error
  }
};

module.exports = exports;
