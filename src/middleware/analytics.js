// src/middleware/analytics.js
// Drop this middleware into your Express app to track real visitor page views.
//
// Usage in server.js / app.js:
//   const analyticsMiddleware = require('./middleware/analytics');
//   app.use(analyticsMiddleware);

const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");

// Paths to ignore (static assets, health checks, API calls)
const IGNORE_PATTERNS = [
  /^\/api\//,
  /^\/health/,
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$/i,
];

module.exports = async function analyticsMiddleware(req, res, next) {
  // Skip non-GET requests and ignored paths
  if (req.method !== "GET") return next();
  if (IGNORE_PATTERNS.some((p) => p.test(req.path))) return next();

  try {
    // Hash the IP address — never store raw IPs (privacy + GDPR)
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const ipHash = crypto.createHash("sha256").update(rawIp).digest("hex");

    await db.query(
      `INSERT INTO page_views (id, path, ip_hash, user_agent, referrer, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        uuidv4(),
        req.path,
        ipHash,
        req.headers["user-agent"] || null,
        req.headers["referer"] || null,
      ],
    );
  } catch (_) {
    // Never block a request because of analytics failure
  }

  next();
};
