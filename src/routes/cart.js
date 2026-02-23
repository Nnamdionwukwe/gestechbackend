// src/routes/cart.js
const express = require("express");
const router = express.Router();
const cartController = require("../controllers/CartController");
const { authenticate, authorize } = require("../middleware/auth");

// ── All cart routes require authentication ────────────────────────────────────
router.use(authenticate);

// ==================== USER ROUTES ====================

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private
 */
router.get("/", cartController.getCart.bind(cartController));

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Private
 * @body    { productId?, serviceVariantId?, quantity }
 */
router.post("/add", cartController.addToCart.bind(cartController));

/**
 * @route   PUT /api/cart/update
 * @desc    Update cart item quantity
 * @access  Private
 * @body    { cartItemId, quantity }
 */
router.put("/update", cartController.updateCartItem.bind(cartController));

/**
 * @route   DELETE /api/cart/remove/:cartItemId
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete(
  "/remove/:cartItemId",
  cartController.removeFromCart.bind(cartController),
);

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear entire cart
 * @access  Private
 */
router.delete("/clear", cartController.clearCart.bind(cartController));

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/cart/admin/all
 * @desc    Get all carts (with user info + item count)
 * @access  Admin
 */
router.get(
  "/admin/all",
  authorize("admin"),
  cartController.getAllCarts.bind(cartController),
);

/**
 * @route   GET /api/cart/admin/user/:userId
 * @desc    Get a specific user's cart
 * @access  Admin
 */
router.get(
  "/admin/user/:userId",
  authorize("admin"),
  cartController.getUserCartAdmin.bind(cartController),
);

/**
 * @route   DELETE /api/cart/admin/user/:userId/clear
 * @desc    Force-clear a specific user's cart
 * @access  Admin
 */
router.delete(
  "/admin/user/:userId/clear",
  authorize("admin"),
  cartController.clearUserCartAdmin.bind(cartController),
);

/**
 * @route   GET /api/cart/admin/stats
 * @desc    Cart statistics (total carts, avg items, abandoned carts)
 * @access  Admin
 */
router.get(
  "/admin/stats",
  authorize("admin"),
  cartController.getCartStats.bind(cartController),
);

module.exports = router;
