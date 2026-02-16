const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticate, authorize } = require("../middleware/auth");

// ========================================
// USER ROUTES (Authenticated)
// ========================================

/**
 * @route   GET /api/payments
 * @desc    Get all payments for authenticated user
 * @access  Private
 * @query   status, limit, offset
 */
router.get("/", authenticate, paymentController.getUserPayments);

/**
 * @route   GET /api/payments/:id
 * @desc    Get single payment by ID
 * @access  Private
 */
router.get("/:id", authenticate, paymentController.getPaymentById);

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Get payment by order ID
 * @access  Private
 */
router.get(
  "/order/:orderId",
  authenticate,
  paymentController.getPaymentByOrderId,
);

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * @route   GET /api/admin/payments
 * @desc    Get all payments (Admin)
 * @access  Private/Admin
 * @query   status, payment_method, limit, offset, search
 */
router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  paymentController.getAllPayments,
);

/**
 * @route   POST /api/admin/payments/:id/verify
 * @desc    Verify Paystack payment manually
 * @access  Private/Admin
 */
router.post(
  "/admin/:id/verify",
  authenticate,
  authorize("admin"),
  paymentController.verifyPayment,
);

/**
 * @route   PUT /api/admin/payments/:id/status
 * @desc    Update payment status
 * @access  Private/Admin
 * @body    { status, notes? }
 */
router.put(
  "/admin/:id/status",
  authenticate,
  authorize("admin"),
  paymentController.updatePaymentStatus,
);

/**
 * @route   GET /api/admin/payments/stats
 * @desc    Get payment statistics
 * @access  Private/Admin
 * @query   start_date?, end_date?
 */
router.get(
  "/admin/stats",
  authenticate,
  authorize("admin"),
  paymentController.getPaymentStats,
);

/**
 * @route   POST /api/admin/payments/:id/refund
 * @desc    Process refund
 * @access  Private/Admin
 * @body    { reason, amount? }
 */
router.post(
  "/admin/:id/refund",
  authenticate,
  authorize("admin"),
  paymentController.refundPayment,
);

module.exports = router;
