// src/routes/orders.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers//orderController");
const { authenticate, authorize } = require("../middleware/auth");

// ========================================
// USER ROUTES (Authenticated)
// ========================================

/**
 * @route   POST /api/orders
 * @desc    Create order from cart
 * @access  Private
 * @body    { shippingAddress, billingAddress?, paymentMethod, notes? }
 */
router.post("/", authenticate, orderController.createOrder);

/**
 * @route   GET /api/orders
 * @desc    Get all orders for authenticated user
 * @access  Private
 * @query   status, limit, offset
 */
router.get("/", authenticate, orderController.getUserOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order by ID
 * @access  Private
 */
router.get("/:id", authenticate, orderController.getOrderById);

/**
 * @route   GET /api/orders/number/:orderNumber
 * @desc    Get order by order number
 * @access  Private
 */
router.get(
  "/number/:orderNumber",
  authenticate,
  orderController.getOrderByNumber,
);

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private
 * @body    { reason }
 */
router.put("/:id/cancel", authenticate, orderController.cancelOrder);

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders (Admin)
 * @access  Private/Admin
 * @query   status, payment_status, limit, offset, search
 */
router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  orderController.getAllOrders,
);

/**
 * @route   PUT /api/admin/orders/:id/status
 * @desc    Update order status
 * @access  Private/Admin
 * @body    { order_status, tracking_number?, notes? }
 */
router.put(
  "/admin/:id/status",
  authenticate,
  authorize("admin"),
  orderController.updateOrderStatus,
);

/**
 * @route   GET /api/admin/orders/stats
 * @desc    Get order statistics
 * @access  Private/Admin
 * @query   start_date?, end_date?
 */
router.get(
  "/admin/stats",
  authenticate,
  authorize("admin"),
  orderController.getOrderStats,
);

module.exports = router;
