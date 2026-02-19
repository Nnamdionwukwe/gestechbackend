// src/routes/admin.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");

// Apply authentication and authorization to all admin routes
router.use(authenticate);
router.use(authorize("admin", "editor"));

/**
 * ADMIN ROUTES - Protected
 * Requires authentication and admin/editor role
 */

// ==================== DASHBOARD ====================

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (Admin, Editor)
 */
router.get("/dashboard/stats", adminController.getDashboardStats);

// ==================== SERVICES MANAGEMENT ====================

/**
 * @route   POST /api/admin/services
 * @desc    Create new service
 * @access  Private (Admin, Editor)
 */
router.post("/services", adminController.createService);

/**
 * @route   PUT /api/admin/services/:id
 * @desc    Update service
 * @access  Private (Admin, Editor)
 */
router.put("/services/:id", adminController.updateService);

/**
 * @route   DELETE /api/admin/services/:id
 * @desc    Delete service
 * @access  Private (Admin, Editor)
 */
router.delete("/services/:id", adminController.deleteService);

// ==================== PORTFOLIO/PROJECTS MANAGEMENT ====================

/**
 * @route   POST /api/admin/projects
 * @desc    Create new project
 * @access  Private (Admin, Editor)
 */
router.post("/projects", adminController.createProject);

/**
 * @route   PUT /api/admin/projects/:id
 * @desc    Update project
 * @access  Private (Admin, Editor)
 */
router.put("/projects/:id", adminController.updateProject);

/**
 * @route   DELETE /api/admin/projects/:id
 * @desc    Delete project
 * @access  Private (Admin, Editor)
 */
router.delete("/projects/:id", adminController.deleteProject);

// ==================== TESTIMONIALS MANAGEMENT ====================

/**
 * @route   POST /api/admin/testimonials
 * @desc    Create new testimonial
 * @access  Private (Admin, Editor)
 */
router.post("/testimonials", adminController.createTestimonial);

/**
 * @route   PUT /api/admin/testimonials/:id
 * @desc    Update testimonial
 * @access  Private (Admin, Editor)
 */
router.put("/testimonials/:id", adminController.updateTestimonial);

/**
 * @route   DELETE /api/admin/testimonials/:id
 * @desc    Delete testimonial
 * @access  Private (Admin, Editor)
 */
router.delete("/testimonials/:id", adminController.deleteTestimonial);

// ==================== TEAM MEMBERS MANAGEMENT ====================

/**
 * @route   POST /api/admin/team
 * @desc    Create new team member
 * @access  Private (Admin, Editor)
 */
router.post("/team", adminController.createTeamMember);

/**
 * @route   PUT /api/admin/team/:id
 * @desc    Update team member
 * @access  Private (Admin, Editor)
 */
router.put("/team/:id", adminController.updateTeamMember);

/**
 * @route   DELETE /api/admin/team/:id
 * @desc    Delete team member
 * @access  Private (Admin, Editor)
 */
router.delete("/team/:id", adminController.deleteTeamMember);

// ==================== BLOG POSTS MANAGEMENT ====================

/**
 * @route   POST /api/admin/blog
 * @desc    Create new blog post
 * @access  Private (Admin, Editor)
 */
router.post("/blog", adminController.createBlogPost);

/**
 * @route   PUT /api/admin/blog/:id
 * @desc    Update blog post
 * @access  Private (Admin, Editor)
 */
router.put("/blog/:id", adminController.updateBlogPost);

/**
 * @route   DELETE /api/admin/blog/:id
 * @desc    Delete blog post
 * @access  Private (Admin, Editor)
 */
router.delete("/blog/:id", adminController.deleteBlogPost);

// ==================== LEADS MANAGEMENT ====================

/**
 * @route   GET /api/admin/leads
 * @desc    Get all leads
 * @access  Private (Admin, Editor)
 */
router.get("/leads", adminController.getAllLeads);

/**
 * @route   PUT /api/admin/leads/:id/status
 * @desc    Update lead status
 * @access  Private (Admin, Editor)
 */
router.put("/leads/:id/status", adminController.updateLeadStatus);

/**
 * @route   DELETE /api/admin/leads/:id
 * @desc    Delete lead
 * @access  Private (Admin, Editor)
 */
router.delete("/leads/:id", adminController.deleteLead);

// ==================== NEWSLETTER SUBSCRIBERS MANAGEMENT ====================

/**
 * @route   GET /api/admin/subscribers
 * @desc    Get all newsletter subscribers
 * @access  Private (Admin, Editor)
 */
router.get("/subscribers", adminController.getAllSubscribers);

/**
 * @route   PUT /api/admin/subscribers/:id/unsubscribe
 * @desc    Unsubscribe user from newsletter
 * @access  Private (Admin, Editor)
 */
router.put("/subscribers/:id/unsubscribe", adminController.unsubscribeUser);

/**
 * @route   DELETE /api/admin/subscribers/:id
 * @desc    Delete subscriber
 * @access  Private (Admin, Editor)
 */
router.delete("/subscribers/:id", adminController.deleteSubscriber);

router.get("/projects", adminController.getAllProjects);

module.exports = router;
