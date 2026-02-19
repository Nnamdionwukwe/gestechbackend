// src/routes/cart.js
const express = require("express");
const router = express.Router();
const cartController = require("../controllers/CartController");
const { authenticate } = require("../middleware/auth");

// All cart routes require authentication
router.use(authenticate);

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
 * @param   cartItemId - The cart item ID to remove
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

module.exports = router;
