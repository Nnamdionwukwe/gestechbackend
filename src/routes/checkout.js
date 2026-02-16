const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/CheckoutController");
const { authenticate, authorize } = require("../middleware/auth");

/**
 * @route   GET /api/checkout
 * @desc    Get checkout summary
 * @access  Private
 */
router.get("/", authenticate, checkoutController.getCheckoutSummary);

/**
 * @route   POST /api/checkout/bank-transfer
 * @desc    Process checkout with bank transfer
 * @access  Private
 * @body    { shippingAddress, billingAddress?, notes? }
 */
router.post(
  "/bank-transfer",
  authenticate,
  checkoutController.bankTransferCheckout,
);

/**
 * @route   POST /api/checkout/paystack/initialize
 * @desc    Initialize Paystack payment
 * @access  Private
 * @body    { email, shippingAddress, billingAddress?, notes? }
 */
router.post(
  "/paystack/initialize",
  authenticate,
  checkoutController.initializePaystackPayment,
);

/**
 * @route   GET /api/checkout/paystack/verify/:reference
 * @desc    Verify Paystack payment
 * @access  Private
 */
router.get(
  "/paystack/verify/:reference",
  authenticate,
  checkoutController.verifyPaystackPayment,
);

/**
 * @route   POST /api/checkout/paystack/webhook
 * @desc    Paystack webhook handler
 * @access  Public (but verified via signature)
 */
router.post("/paystack/webhook", checkoutController.paystackWebhook);

/**
 * @route   PUT /api/checkout/bank-transfer/confirm/:orderId
 * @desc    Confirm bank transfer payment (Admin only)
 * @access  Private/Admin
 * @body    { transactionReference }
 */
router.put(
  "/bank-transfer/confirm/:orderId",
  authenticate,
  authorize("admin"),
  checkoutController.confirmBankTransfer,
);

module.exports = router;
