// src/routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Called by the frontend after Google Sign-In returns an idToken
// Body: { idToken: "<google credential jwt>" }
router.post("/google/verify", authController.googleVerify);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get("/me", authenticate, authController.getCurrentUser);
router.put("/profile", authenticate, authController.updateProfile);
router.post("/change-password", authenticate, authController.changePassword);

module.exports = router;
