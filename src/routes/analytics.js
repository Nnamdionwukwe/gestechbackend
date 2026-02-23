// src/routes/analytics.js
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");

// POST /api/analytics/track/pageview
router.post("/track/pageview", optionalAuth, analyticsController.trackPageView);

// POST /api/analytics/track/event
router.post("/track/event", optionalAuth, analyticsController.trackEvent);

// GET /api/analytics/summary
router.get(
  "/summary",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getAnalyticsSummary,
);

// GET /api/analytics/page
router.get(
  "/page",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getPageAnalytics,
);

// GET /api/analytics/events
router.get(
  "/events",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getEventAnalytics,
);

// GET /api/analytics/admin?days=30  ← admin dashboard endpoint lives HERE
router.get(
  "/admin",
  authenticate,
  authorize("admin"),
  analyticsController.getAnalytics,
);

module.exports = router;
