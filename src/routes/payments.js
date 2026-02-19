// src/routes/payments.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticate, authorize } = require("../middleware/auth");

// ── ADMIN ROUTES (must come before /:id wildcard) ─────────────────────────

/**
 * @route   GET /api/payments/admin/stats
 * @desc    Get payment statistics
 * @access  Private/Admin
 */
router.get(
  "/admin/stats",
  authenticate,
  authorize("admin"),
  paymentController.getPaymentStats.bind(paymentController),
);

/**
 * @route   GET /api/payments/admin/all
 * @desc    Get all payments (admin view)
 * @access  Private/Admin
 */
router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  paymentController.getAllPayments.bind(paymentController),
);

/**
 * @route   POST /api/payments/admin/:id/verify
 * @desc    Manually verify a Paystack payment
 * @access  Private/Admin
 */
router.post(
  "/admin/:id/verify",
  authenticate,
  authorize("admin"),
  paymentController.verifyPayment.bind(paymentController),
);

/**
 * @route   PUT /api/payments/admin/:id/status
 * @desc    Update payment status manually
 * @access  Private/Admin
 */
router.put(
  "/admin/:id/status",
  authenticate,
  authorize("admin"),
  paymentController.updatePaymentStatus.bind(paymentController),
);

/**
 * @route   POST /api/payments/admin/:id/refund
 * @desc    Process a refund
 * @access  Private/Admin
 */
router.post(
  "/admin/:id/refund",
  authenticate,
  authorize("admin"),
  paymentController.refundPayment.bind(paymentController),
);

// ── USER ROUTES ────────────────────────────────────────────────────────────

/**
 * @route   GET /api/payments
 * @desc    Get all payments for authenticated user
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  paymentController.getUserPayments.bind(paymentController),
);

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Get payment by order ID
 * @access  Private
 */
router.get(
  "/order/:orderId",
  authenticate,
  paymentController.getPaymentByOrderId.bind(paymentController),
);

/**
 * @route   GET /api/payments/:id
 * @desc    Get single payment by ID
 * @access  Private
 */
router.get(
  "/:id",
  authenticate,
  paymentController.getPaymentById.bind(paymentController),
);

module.exports = router;
