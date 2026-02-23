// src/controllers/CartController.js
const db = require("../config/database");

class CartController {
  /**
   * Helper: Build formatted cart response from a connected client
   * Used internally to avoid connection conflicts
   */
  async _buildCartResponse(client, cartId) {
    const cartResult = await client.query("SELECT * FROM carts WHERE id = $1", [
      cartId,
    ]);

    const cart = cartResult.rows[0];

    const itemsResult = await client.query(
      `
      SELECT 
        ci.id, ci.quantity, ci.price, ci.item_type,
        -- Product fields
        p.id as product_id, p.name as product_name, p.description as product_description, 
        p.stock as product_stock, p.images as product_images,
        -- Service variant fields
        sv.id as variant_id, sv.name as variant_name, sv.description as variant_description,
        sv.duration, sv.features,
        s.id as service_id, s.name as service_name, s.category as service_category
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id AND ci.item_type = 'product'
      LEFT JOIN service_variants sv ON ci.service_variant_id = sv.id AND ci.item_type = 'service'
      LEFT JOIN services s ON sv.service_id = s.id
      WHERE ci.cart_id = $1
      `,
      [cartId],
    );

    const formattedItems = itemsResult.rows.map((item) => {
      if (item.item_type === "product") {
        return {
          id: item.id,
          type: "product",
          product: {
            id: item.product_id,
            name: item.product_name,
            description: item.product_description,
            stock: item.product_stock,
            images: item.product_images,
          },
          quantity: item.quantity,
          price: parseFloat(item.price),
        };
      } else {
        return {
          id: item.id,
          type: "service",
          service: {
            id: item.service_id,
            name: item.service_name,
            category: item.service_category,
          },
          variant: {
            id: item.variant_id,
            name: item.variant_name,
            description: item.variant_description,
            duration: item.duration,
            features: item.features,
          },
          quantity: item.quantity,
          price: parseFloat(item.price),
        };
      }
    });

    return {
      id: cart.id,
      user_id: cart.user_id,
      subtotal: parseFloat(cart.subtotal),
      total: parseFloat(cart.total),
      items: formattedItems,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }

  /**
   * Helper: Get or create a cart for the user (within an existing transaction)
   */
  async _getOrCreateCart(client, userId) {
    const cartResult = await client.query(
      "SELECT * FROM carts WHERE user_id = $1",
      [userId],
    );

    if (cartResult.rows.length === 0) {
      const newCartResult = await client.query(
        "INSERT INTO carts (user_id, subtotal, total) VALUES ($1, 0, 0) RETURNING *",
        [userId],
      );
      return newCartResult.rows[0];
    }

    return cartResult.rows[0];
  }

  /**
   * Helper: Recalculate and update cart totals (within an existing transaction)
   */
  async _recalculateTotals(client, cartId) {
    const totalsResult = await client.query(
      "SELECT SUM(quantity * price) as subtotal FROM cart_items WHERE cart_id = $1",
      [cartId],
    );

    const subtotal = parseFloat(totalsResult.rows[0].subtotal) || 0;

    await client.query(
      "UPDATE carts SET subtotal = $1, total = $1 WHERE id = $2",
      [subtotal, cartId],
    );

    return subtotal;
  }

  /**
   * Get user's cart
   * GET /api/cart
   */
  async getCart(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;

      const cart = await this._getOrCreateCart(client, userId);
      const cartData = await this._buildCartResponse(client, cart.id);

      return res.json({
        success: true,
        data: cartData,
      });
    } catch (error) {
      console.error("Get cart error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch cart",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Add item to cart (product or service variant)
   * POST /api/cart/add
   */
  async addToCart(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { productId, serviceVariantId, quantity = 1 } = req.body;

      if (!productId && !serviceVariantId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Either productId or serviceVariantId is required",
        });
      }

      let itemType, itemId, price, stockCheck;

      // Handle product
      if (productId) {
        const productResult = await client.query(
          "SELECT * FROM products WHERE id = $1 AND is_active = true",
          [productId],
        );

        if (productResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            success: false,
            error: "Product not found",
          });
        }

        const product = productResult.rows[0];

        if (product.stock < quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "Insufficient stock available",
          });
        }

        itemType = "product";
        itemId = productId;
        price = product.price;
        stockCheck = product.stock;
      }
      // Handle service variant
      else {
        const variantResult = await client.query(
          `SELECT sv.*, s.is_active as service_active
           FROM service_variants sv
           JOIN services s ON sv.service_id = s.id
           WHERE sv.id = $1 AND sv.is_active = true`,
          [serviceVariantId],
        );

        if (variantResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            success: false,
            error: "Service variant not found",
          });
        }

        const variant = variantResult.rows[0];

        if (!variant.service_active) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "Service is not active",
          });
        }

        itemType = "service";
        itemId = serviceVariantId;
        price = variant.price;
        stockCheck = null; // Services don't have stock
      }

      // Get or create cart
      const cart = await this._getOrCreateCart(client, userId);

      // Check if item already in cart
      const existingItemQuery =
        itemType === "product"
          ? "SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2 AND item_type = 'product'"
          : "SELECT * FROM cart_items WHERE cart_id = $1 AND service_variant_id = $2 AND item_type = 'service'";

      const existingItemResult = await client.query(existingItemQuery, [
        cart.id,
        itemId,
      ]);

      if (existingItemResult.rows.length > 0) {
        // Update quantity
        const existingItem = existingItemResult.rows[0];
        const newQuantity = existingItem.quantity + quantity;

        // Check stock for products
        if (itemType === "product" && stockCheck < newQuantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "Insufficient stock for requested quantity",
          });
        }

        await client.query(
          "UPDATE cart_items SET quantity = $1, price = $2 WHERE id = $3",
          [newQuantity, price, existingItem.id],
        );
      } else {
        // Add new item
        if (itemType === "product") {
          await client.query(
            "INSERT INTO cart_items (cart_id, product_id, item_type, quantity, price) VALUES ($1, $2, 'product', $3, $4)",
            [cart.id, itemId, quantity, price],
          );
        } else {
          await client.query(
            "INSERT INTO cart_items (cart_id, service_variant_id, item_type, quantity, price) VALUES ($1, $2, 'service', $3, $4)",
            [cart.id, itemId, quantity, price],
          );
        }
      }

      // Recalculate totals
      await this._recalculateTotals(client, cart.id);

      await client.query("COMMIT");

      // ✅ Build response BEFORE finally releases the client
      const cartData = await this._buildCartResponse(client, cart.id);

      return res.json({
        success: true,
        data: cartData,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Add to cart error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to add item to cart",
        message: error.message,
      });
    } finally {
      client.release(); // ✅ Released AFTER response is built and sent
    }
  }

  /**
   * Update cart item quantity
   * PUT /api/cart/update
   */
  async updateCartItem(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { cartItemId, quantity } = req.body;

      if (quantity < 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Quantity must be at least 1",
        });
      }

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (cartResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Cart not found",
        });
      }

      const cart = cartResult.rows[0];

      // Get cart item
      const itemResult = await client.query(
        "SELECT * FROM cart_items WHERE id = $1 AND cart_id = $2",
        [cartItemId, cart.id],
      );

      if (itemResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Item not found in cart",
        });
      }

      const item = itemResult.rows[0];

      // Check stock for products
      if (item.item_type === "product") {
        const productResult = await client.query(
          "SELECT stock FROM products WHERE id = $1",
          [item.product_id],
        );

        if (productResult.rows[0].stock < quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "Insufficient stock available",
          });
        }
      }

      // Update quantity
      await client.query("UPDATE cart_items SET quantity = $1 WHERE id = $2", [
        quantity,
        cartItemId,
      ]);

      // Recalculate totals
      await this._recalculateTotals(client, cart.id);

      await client.query("COMMIT");

      // ✅ Build response BEFORE finally releases the client
      const cartData = await this._buildCartResponse(client, cart.id);

      return res.json({
        success: true,
        data: cartData,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update cart error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update cart",
        message: error.message,
      });
    } finally {
      client.release(); // ✅ Released AFTER response is built and sent
    }
  }

  /**
   * Remove item from cart
   * DELETE /api/cart/remove/:cartItemId
   */
  async removeFromCart(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { cartItemId } = req.params;

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (cartResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Cart not found",
        });
      }

      const cart = cartResult.rows[0];

      // Delete item
      await client.query(
        "DELETE FROM cart_items WHERE id = $1 AND cart_id = $2",
        [cartItemId, cart.id],
      );

      // Recalculate totals
      await this._recalculateTotals(client, cart.id);

      await client.query("COMMIT");

      // ✅ Build response BEFORE finally releases the client
      const cartData = await this._buildCartResponse(client, cart.id);

      return res.json({
        success: true,
        data: cartData,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Remove from cart error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to remove item from cart",
        message: error.message,
      });
    } finally {
      client.release(); // ✅ Released AFTER response is built and sent
    }
  }

  /**
   * Clear cart
   * DELETE /api/cart/clear
   */
  async clearCart(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (cartResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Cart not found",
        });
      }

      const cart = cartResult.rows[0];

      // Delete all items
      await client.query("DELETE FROM cart_items WHERE cart_id = $1", [
        cart.id,
      ]);

      // Reset totals
      await client.query(
        "UPDATE carts SET subtotal = 0, total = 0 WHERE id = $1",
        [cart.id],
      );

      await client.query("COMMIT");

      // ✅ Build response BEFORE finally releases the client
      const cartData = await this._buildCartResponse(client, cart.id);

      return res.json({
        success: true,
        data: cartData,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Clear cart error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to clear cart",
        message: error.message,
      });
    } finally {
      client.release(); // ✅ Released AFTER response is built and sent
    }
  }

  // ── ADD these 4 methods to CartController.js (inside the class, before the closing brace) ──

  /**
   * GET /api/cart/admin/all
   * All carts with user info + item count
   */
  async getAllCarts(req, res) {
    const client = await db.pool.connect();
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const offset = (page - 1) * limit;

      const carts = await client.query(
        `SELECT
           c.id, c.subtotal, c.total, c.created_at, c.updated_at,
           u.id AS user_id, u.full_name, u.email,
           COUNT(ci.id) AS item_count
         FROM carts c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN cart_items ci ON ci.cart_id = c.id
         ${search ? "WHERE u.email ILIKE $3 OR u.full_name ILIKE $3" : ""}
         GROUP BY c.id, u.id, u.full_name, u.email
         ORDER BY c.updated_at DESC
         LIMIT $1 OFFSET $2`,
        search ? [limit, offset, `%${search}%`] : [limit, offset],
      );

      const total = await client.query(
        `SELECT COUNT(*) FROM carts c
         LEFT JOIN users u ON c.user_id = u.id
         ${search ? "WHERE u.email ILIKE $1 OR u.full_name ILIKE $1" : ""}`,
        search ? [`%${search}%`] : [],
      );

      return res.json({
        success: true,
        data: carts.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total.rows[0].count),
          pages: Math.ceil(total.rows[0].count / limit),
        },
      });
    } catch (error) {
      console.error("Admin getAllCarts error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch carts" });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/cart/admin/user/:userId
   * View a specific user's full cart
   */
  async getUserCartAdmin(req, res) {
    const client = await db.pool.connect();
    try {
      const { userId } = req.params;

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (!cartResult.rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "No cart found for this user" });
      }

      const cartData = await this._buildCartResponse(
        client,
        cartResult.rows[0].id,
      );

      return res.json({ success: true, data: cartData });
    } catch (error) {
      console.error("Admin getUserCart error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch user cart" });
    } finally {
      client.release();
    }
  }

  /**
   * DELETE /api/cart/admin/user/:userId/clear
   * Force-clear a user's cart
   */
  async clearUserCartAdmin(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const { userId } = req.params;

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (!cartResult.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "No cart found for this user" });
      }

      const cartId = cartResult.rows[0].id;

      await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
      await client.query(
        "UPDATE carts SET subtotal = 0, total = 0 WHERE id = $1",
        [cartId],
      );

      await client.query("COMMIT");

      return res.json({ success: true, message: "Cart cleared successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Admin clearUserCart error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to clear cart" });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/cart/admin/stats
   * Aggregate cart statistics
   */
  async getCartStats(req, res) {
    const client = await db.pool.connect();
    try {
      const [overview, topProducts, abandoned] = await Promise.all([
        // Overview counts
        client.query(`
          SELECT
            COUNT(DISTINCT c.id)                                    AS total_carts,
            COUNT(ci.id)                                            AS total_items,
            ROUND(AVG(item_counts.cnt), 1)                         AS avg_items_per_cart,
            ROUND(AVG(c.total)::numeric, 2)                        AS avg_cart_value,
            SUM(c.total)                                            AS total_cart_value,
            COUNT(DISTINCT CASE WHEN c.total = 0 THEN c.id END)    AS empty_carts,
            COUNT(DISTINCT CASE
              WHEN c.updated_at < NOW() - INTERVAL '7 days'
               AND c.total > 0 THEN c.id END)                      AS abandoned_carts
          FROM carts c
          LEFT JOIN cart_items ci ON ci.cart_id = c.id
          LEFT JOIN (
            SELECT cart_id, COUNT(*) AS cnt FROM cart_items GROUP BY cart_id
          ) item_counts ON item_counts.cart_id = c.id
        `),

        // Top 5 most carted products
        client.query(`
          SELECT
            p.id, p.name,
            COUNT(ci.id)      AS times_carted,
            SUM(ci.quantity)  AS total_quantity
          FROM cart_items ci
          JOIN products p ON ci.product_id = p.id
          WHERE ci.item_type = 'product'
          GROUP BY p.id, p.name
          ORDER BY times_carted DESC
          LIMIT 5
        `),

        // Carts not updated in > 7 days with items still in them
        client.query(`
          SELECT
            c.id, c.total, c.updated_at,
            u.full_name, u.email,
            COUNT(ci.id) AS item_count
          FROM carts c
          JOIN users u ON c.user_id = u.id
          JOIN cart_items ci ON ci.cart_id = c.id
          WHERE c.updated_at < NOW() - INTERVAL '7 days'
            AND c.total > 0
          GROUP BY c.id, u.full_name, u.email
          ORDER BY c.updated_at ASC
          LIMIT 10
        `),
      ]);

      return res.json({
        success: true,
        data: {
          overview: overview.rows[0],
          topProducts: topProducts.rows,
          abandonedCarts: abandoned.rows,
        },
      });
    } catch (error) {
      console.error("Admin getCartStats error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch cart stats" });
    } finally {
      client.release();
    }
  }

  // ── Also fix this typo on line ~24 of CartController.js ───────────────────────
  // FIND:    const itemsResult = await client.qåuery(
  // REPLACE: const itemsResult = await client.query(
}

module.exports = new CartController();
