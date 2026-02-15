// src/routes/agency.js
const express = require("express");
const router = express.Router();
const servicesController = require("../controllers/servicesController");

/**
 * PUBLIC ROUTES - No authentication required
 */

// ==================== SERVICES ====================

/**
 * @route   GET /api/agency/services
 * @desc    Get all services
 * @access  Public
 * @query   category - Filter by category (optional)
 */
router.get("/services", servicesController.getAllServices);

/**
 * @route   GET /api/agency/services/:slug
 * @desc    Get service by slug with projects and testimonials
 * @access  Public
 */
router.get("/services/:slug", servicesController.getServiceBySlug);

// ==================== PORTFOLIO ====================

/**
 * @route   GET /api/agency/portfolio
 * @desc    Get portfolio/projects
 * @access  Public
 * @query   category, technology, page, limit
 */
router.get("/portfolio", servicesController.getPortfolio);

/**
 * @route   GET /api/agency/portfolio/:slug
 * @desc    Get project details by slug
 * @access  Public
 */
router.get("/portfolio/:slug", servicesController.getProjectBySlug);

// ==================== TESTIMONIALS ====================

/**
 * @route   GET /api/agency/testimonials
 * @desc    Get client testimonials
 * @access  Public
 * @query   service, featured
 */
router.get("/testimonials", servicesController.getTestimonials);

// ==================== TEAM ====================

/**
 * @route   GET /api/agency/team
 * @desc    Get team members
 * @access  Public
 * @query   department
 */
router.get("/team", servicesController.getTeamMembers);

// ==================== TECHNOLOGIES ====================

/**
 * @route   GET /api/agency/technologies
 * @desc    Get technologies/tech stack
 * @access  Public
 */
router.get("/technologies", servicesController.getTechnologies);

// ==================== CONTACT ====================

/**
 * @route   POST /api/agency/contact
 * @desc    Submit contact/inquiry form
 * @access  Public
 * @body    { name, email, phone, company, service, budget, message, timeline }
 */
router.post("/contact", servicesController.submitContactForm);

/**
 * @route   POST /api/agency/newsletter
 * @desc    Subscribe to newsletter
 * @access  Public
 * @body    { email, name }
 */
router.post("/newsletter", servicesController.subscribeNewsletter);

// ==================== BLOG ====================

/**
 * @route   GET /api/agency/blog
 * @desc    Get blog posts
 * @access  Public
 * @query   category, tag, page, limit
 */
router.get("/blog", servicesController.getBlogPosts);

/**
 * @route   GET /api/agency/blog/:slug
 * @desc    Get blog post by slug
 * @access  Public
 */
router.get("/blog/:slug", servicesController.getBlogPostBySlug);

module.exports = router;
