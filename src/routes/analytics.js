// src/routes/analytics.js
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");

/**
 * ANALYTICS ROUTES
 */

// ==================== PUBLIC TRACKING ====================

/**
 * @route   POST /api/analytics/track/pageview
 * @desc    Track page view
 * @access  Public
 * @body    { page_url, page_title, referrer }
 */
router.post("/track/pageview", optionalAuth, analyticsController.trackPageView);

/**
 * @route   POST /api/analytics/track/event
 * @desc    Track custom event
 * @access  Public
 * @body    { event_name, event_category, event_label, event_value, metadata }
 */
router.post("/track/event", optionalAuth, analyticsController.trackEvent);

// ==================== ADMIN ANALYTICS ====================

/**
 * @route   GET /api/analytics/summary
 * @desc    Get analytics summary
 * @access  Private (Admin, Editor)
 * @query   start_date, end_date
 */
router.get(
  "/summary",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getAnalyticsSummary,
);

/**
 * @route   GET /api/analytics/page
 * @desc    Get page-specific analytics
 * @access  Private (Admin, Editor)
 * @query   page_url
 */
router.get(
  "/page",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getPageAnalytics,
);

/**
 * @route   GET /api/analytics/events
 * @desc    Get event analytics
 * @access  Private (Admin, Editor)
 * @query   event_category, start_date, end_date
 */
router.get(
  "/events",
  authenticate,
  authorize("admin", "editor"),
  analyticsController.getEventAnalytics,
);

module.exports = router;
