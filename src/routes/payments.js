// src/routes/paystack.js
const express = require("express");
const router = express.Router();
const paystackController = require("../controllers/paystackController");
const { authenticate } = require("../middleware/auth");

/**
 * @route   POST /api/paystack/initialize
 * @desc    Initialize Paystack payment and get public_key + reference
 * @access  Private
 */
router.post(
  "/initialize",
  authenticate,
  paystackController.initializePayment.bind(paystackController),
);

/**
 * @route   GET /api/paystack/verify/:reference
 * @desc    Verify Paystack payment after popup callback
 * @access  Private
 */
router.get(
  "/verify/:reference",
  authenticate,
  paystackController.verifyPayment.bind(paystackController),
);

/**
 * @route   POST /api/paystack/webhook
 * @desc    Paystack webhook (no auth — verified by signature)
 * @access  Public
 */
router.post(
  "/webhook",
  paystackController.handleWebhook.bind(paystackController),
);

/**
 * @route   GET /api/paystack/banks
 * @desc    Get list of Nigerian banks
 * @access  Public
 */
router.get("/banks", paystackController.getBanks.bind(paystackController));

/**
 * @route   POST /api/paystack/verify-account
 * @desc    Verify bank account number
 * @access  Private
 */
router.post(
  "/verify-account",
  authenticate,
  paystackController.verifyAccountNumber.bind(paystackController),
);

module.exports = router;
