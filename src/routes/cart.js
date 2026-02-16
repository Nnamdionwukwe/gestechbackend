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
router.get("/", cartController.getCart);

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Private
 * @body    { productId, quantity }
 */
router.post("/add", cartController.addToCart);

/**
 * @route   PUT /api/cart/update
 * @desc    Update cart item quantity
 * @access  Private
 * @body    { productId, quantity }
 */
router.put("/update", cartController.updateCartItem);

/**
 * @route   DELETE /api/cart/remove/:productId
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete("/remove/:productId", cartController.removeFromCart);

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear entire cart
 * @access  Private
 */
router.delete("/clear", cartController.clearCart);

module.exports = router;
