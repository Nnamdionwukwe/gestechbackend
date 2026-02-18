// src/routes/contact.js
const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const { authenticate, authorize } = require("../middleware/auth");

// ========================================
// PUBLIC ROUTES
// ========================================

/**
 * @route   POST /api/contact
 * @desc    Submit contact form
 * @access  Public
 * @body    { name, email, phone?, company?, service, budget?, message, timeline? }
 */
router.post("/", contactController.submitContactForm);

/**
 * @route   POST /api/contact/newsletter
 * @desc    Subscribe to newsletter
 * @access  Public
 * @body    { email, name? }
 */
router.post("/newsletter", contactController.subscribeNewsletter);

// ========================================
// ADMIN ROUTES - LEADS MANAGEMENT
// ========================================

/**
 * @route   GET /api/admin/contact/leads
 * @desc    Get all leads with filters
 * @access  Private/Admin
 * @query   status?, service?, page?, limit?, search?, start_date?, end_date?, sort_by?, sort_order?
 */
router.get(
  "/admin/leads",
  authenticate,
  authorize("admin"),
  contactController.getAllLeads,
);

/**
 * @route   GET /api/admin/contact/leads/:id
 * @desc    Get single lead by ID
 * @access  Private/Admin
 */
router.get(
  "/admin/leads/:id",
  authenticate,
  authorize("admin"),
  contactController.getLeadById,
);

/**
 * @route   PUT /api/admin/contact/leads/:id/status
 * @desc    Update lead status
 * @access  Private/Admin
 * @body    { status, notes? }
 */
router.put(
  "/admin/leads/:id/status",
  authenticate,
  authorize("admin"),
  contactController.updateLeadStatus,
);

/**
 * @route   PUT /api/admin/contact/leads/:id/notes
 * @desc    Add/update notes for a lead
 * @access  Private/Admin
 * @body    { notes }
 */
router.put(
  "/admin/leads/:id/notes",
  authenticate,
  authorize("admin"),
  contactController.addNotesToLead,
);

/**
 * @route   DELETE /api/admin/contact/leads/:id
 * @desc    Delete a lead
 * @access  Private/Admin
 */
router.delete(
  "/admin/leads/:id",
  authenticate,
  authorize("admin"),
  contactController.deleteLead,
);

/**
 * @route   GET /api/admin/contact/stats
 * @desc    Get lead statistics and analytics
 * @access  Private/Admin
 * @query   start_date?, end_date?
 */
router.get(
  "/admin/stats",
  authenticate,
  authorize("admin"),
  contactController.getLeadStats,
);

/**
 * @route   GET /api/admin/contact/leads/export
 * @desc    Export leads to CSV
 * @access  Private/Admin
 * @query   status?, service?, start_date?, end_date?
 */
router.get(
  "/admin/leads-export",
  authenticate,
  authorize("admin"),
  contactController.exportLeads,
);

// ========================================
// ADMIN ROUTES - NEWSLETTER MANAGEMENT
// ========================================

/**
 * @route   GET /api/admin/contact/subscribers
 * @desc    Get all newsletter subscribers
 * @access  Private/Admin
 * @query   page?, limit?, search?
 */
router.get(
  "/admin/subscribers",
  authenticate,
  authorize("admin"),
  contactController.getAllSubscribers,
);

/**
 * @route   PUT /api/admin/contact/subscribers/:id/unsubscribe
 * @desc    Unsubscribe a user
 * @access  Private/Admin
 */
router.put(
  "/admin/subscribers/:id/unsubscribe",
  authenticate,
  authorize("admin"),
  contactController.unsubscribeUser,
);

/**
 * @route   DELETE /api/admin/contact/subscribers/:id
 * @desc    Delete a subscriber
 * @access  Private/Admin
 */
router.delete(
  "/admin/subscribers/:id",
  authenticate,
  authorize("admin"),
  contactController.deleteSubscriber,
);

module.exports = router;
