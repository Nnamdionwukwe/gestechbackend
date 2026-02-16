// src/routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/auth");

/**
 * AUTHENTICATION ROUTES
 */

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 * @body    { email, password, full_name, role }
 */
router.post("/register", authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post("/login", authController.login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 * @body    { email }
 */
router.post("/forgot-password", authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    { token, new_password }
 */
router.post("/reset-password", authController.resetPassword);

// ==================== PROTECTED ROUTES ====================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { full_name, phone, avatar }
 */
router.put("/profile", authenticate, authController.updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { current_password, new_password }
 */
router.put("/change-password", authenticate, authController.changePassword);

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/users",
  authenticate,
  authorize("admin"),
  authController.getAllUsers,
);

/**
 * @route   PUT /api/auth/users/:id/role
 * @desc    Update user role (Admin only)
 * @access  Private (Admin)
 * @body    { role }
 */
router.put(
  "/users/:id/role",
  authenticate,
  authorize("admin"),
  authController.updateUserRole,
);

/**
 * @route   PUT /api/auth/users/:id/toggle-status
 * @desc    Toggle user active status (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/users/:id/toggle-status",
  authenticate,
  authorize("admin"),
  authController.toggleUserStatus,
);

module.exports = router;
