// src/routes/orders.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
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
router.post(
  "/",
  authenticate,
  orderController.createOrder.bind(orderController),
);

/**
 * @route   GET /api/orders
 * @desc    Get all orders for authenticated user
 * @access  Private
 * @query   status, limit, offset
 */
router.get(
  "/",
  authenticate,
  orderController.getUserOrders.bind(orderController),
);

/**
 * @route   GET /api/orders/number/:orderNumber
 * @desc    Get order by order number (must be before /:id to avoid conflict)
 * @access  Private
 */
router.get(
  "/number/:orderNumber",
  authenticate,
  orderController.getOrderByNumber.bind(orderController),
);

/**
 * @route   GET /api/orders/admin/stats
 * @desc    Get order statistics (Admin)
 * @access  Private/Admin
 * @query   start_date?, end_date?
 */
router.get(
  "/admin/stats",
  authenticate,
  authorize("admin"),
  orderController.getOrderStats.bind(orderController),
);

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
  orderController.getAllOrders.bind(orderController),
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
  orderController.updateOrderStatus.bind(orderController),
);

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order by ID (must be after specific routes)
 * @access  Private
 */
router.get(
  "/:id",
  authenticate,
  orderController.getOrderById.bind(orderController),
);

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private
 * @body    { reason }
 */
router.put(
  "/:id/cancel",
  authenticate,
  orderController.cancelOrder.bind(orderController),
);

module.exports = router;
