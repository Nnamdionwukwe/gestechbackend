// src/routes/Paystack.js - FIXED VERSION
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");

// Import the controller - Make sure this path is correct!
const paystackController = require("../controllers/paystackController");

// DEBUGGING: Check what we imported
console.log("Paystack Controller:", typeof paystackController);
console.log("Available methods:", Object.keys(paystackController));

/**
 * @route   POST /api/paystack/initialize
 * @desc    Initialize Paystack payment
 * @access  Private
 */
router.post(
  "/initialize",
  authenticate,
  // Check if the function exists before using it
  paystackController.initializePayment ||
    ((req, res) => {
      res.status(500).json({
        success: false,
        error: "initializePayment function not found in controller",
      });
    }),
);

/**
 * @route   GET /api/paystack/verify/:reference
 * @desc    Verify Paystack payment
 * @access  Private
 */
router.get(
  "/verify/:reference",
  authenticate,
  paystackController.verifyPayment ||
    ((req, res) => {
      res.status(500).json({
        success: false,
        error: "verifyPayment function not found in controller",
      });
    }),
);

/**
 * @route   POST /api/paystack/webhook
 * @desc    Paystack webhook for payment notifications
 * @access  Public (but verified with signature)
 */
router.post(
  "/webhook",
  paystackController.handleWebhook ||
    ((req, res) => {
      res.status(500).json({
        success: false,
        error: "handleWebhook function not found in controller",
      });
    }),
);

/**
 * @route   GET /api/paystack/banks
 * @desc    Get list of Nigerian banks
 * @access  Public
 */
router.get(
  "/banks",
  paystackController.getBanks ||
    ((req, res) => {
      res.status(500).json({
        success: false,
        error: "getBanks function not found in controller",
      });
    }),
);

/**
 * @route   POST /api/paystack/verify-account
 * @desc    Verify bank account number
 * @access  Private
 */
router.post(
  "/verify-account",
  authenticate,
  paystackController.verifyAccountNumber ||
    ((req, res) => {
      res.status(500).json({
        success: false,
        error: "verifyAccountNumber function not found in controller",
      });
    }),
);

module.exports = router;
