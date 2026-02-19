// src/routes/admin.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin", "editor"));

// ==================== DASHBOARD ====================
router.get("/dashboard/stats", adminController.getDashboardStats);

// ==================== SERVICES ====================
// No getAllServices in controller yet — GET route omitted
router.post("/services", adminController.createService);
router.put("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);

// ==================== PROJECTS ====================
router.get("/projects", adminController.getAllProjects);
router.post("/projects", adminController.createProject);
router.put("/projects/:id", adminController.updateProject);
router.delete("/projects/:id", adminController.deleteProject);

// ==================== TESTIMONIALS ====================
// No getAllTestimonials in controller yet — GET route omitted
router.post("/testimonials", adminController.createTestimonial);
router.put("/testimonials/:id", adminController.updateTestimonial);
router.delete("/testimonials/:id", adminController.deleteTestimonial);

// ==================== TEAM MEMBERS ====================
router.get("/team", adminController.getAllTeamMembers);
router.post("/team", adminController.createTeamMember);
router.put("/team/:id", adminController.updateTeamMember);
router.delete("/team/:id", adminController.deleteTeamMember);

// ==================== BLOG POSTS ====================
router.get("/blog", adminController.getAllBlogPosts);
router.post("/blog", adminController.createBlogPost);
router.put("/blog/:id", adminController.updateBlogPost);
router.delete("/blog/:id", adminController.deleteBlogPost);

// ==================== LEADS ====================
router.get("/leads", adminController.getAllLeads);
router.put("/leads/:id/status", adminController.updateLeadStatus);
router.delete("/leads/:id", adminController.deleteLead);

// ==================== NEWSLETTER SUBSCRIBERS ====================
router.get("/subscribers", adminController.getAllSubscribers);
router.put("/subscribers/:id/unsubscribe", adminController.unsubscribeUser);
router.delete("/subscribers/:id", adminController.deleteSubscriber);

module.exports = router;
