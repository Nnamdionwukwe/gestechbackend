// src/controllers/orderController.js
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

class OrderController {
  /**
   * Create order from cart
   * POST /api/orders
   */
  async createOrder(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { shippingAddress, billingAddress, paymentMethod, notes } =
        req.body;

      console.log("📦 Creating order for user:", userId);

      // Validation
      if (!shippingAddress || !paymentMethod) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Shipping address and payment method are required",
        });
      }

      // Get user's cart
      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (cartResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Cart is empty",
        });
      }

      const cart = cartResult.rows[0];

      if (parseFloat(cart.total) <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Cart is empty",
        });
      }

      // Get cart items
      const cartItemsResult = await client.query(
        `SELECT 
          ci.*,
          p.name as product_name,
          p.price as product_price,
          sv.name as variant_name,
          sv.price as variant_price,
          s.name as service_name
         FROM cart_items ci
         LEFT JOIN products p ON ci.product_id = p.id AND ci.item_type = 'product'
         LEFT JOIN service_variants sv ON ci.service_variant_id = sv.id AND ci.item_type = 'service'
         LEFT JOIN services s ON sv.service_id = s.id
         WHERE ci.cart_id = $1`,
        [cart.id],
      );

      if (cartItemsResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Cart is empty",
        });
      }

      console.log("✅ Cart has", cartItemsResult.rows.length, "items");

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      console.log("📋 Order number:", orderNumber);

      // Calculate totals
      const subtotal = parseFloat(cart.subtotal);
      const shippingCost = 0; // You can add shipping calculation logic here
      const tax = 0; // You can add tax calculation logic here
      const total = subtotal + shippingCost + tax;

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          id,
          user_id,
          order_number,
          order_status,
          payment_status,
          payment_method,
          subtotal,
          shipping_cost,
          tax,
          total,
          shipping_address,
          billing_address,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          uuidv4(),
          userId,
          orderNumber,
          "pending",
          "pending",
          paymentMethod,
          subtotal,
          shippingCost,
          tax,
          total,
          JSON.stringify(shippingAddress),
          JSON.stringify(billingAddress || shippingAddress),
          notes || null,
        ],
      );

      const order = orderResult.rows[0];
      console.log("✅ Order created:", order.id);

      // Create order items
      for (const item of cartItemsResult.rows) {
        const itemName =
          item.item_type === "product"
            ? item.product_name
            : `${item.service_name} - ${item.variant_name}`;

        await client.query(
          `INSERT INTO order_items (
            order_id,
            product_id,
            service_variant_id,
            item_type,
            quantity,
            price,
            item_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            order.id,
            item.product_id || null,
            item.service_variant_id || null,
            item.item_type,
            item.quantity,
            item.price,
            itemName,
          ],
        );

        // Reduce product stock if it's a product
        if (item.item_type === "product" && item.product_id) {
          await client.query(
            "UPDATE products SET stock = stock - $1 WHERE id = $2",
            [item.quantity, item.product_id],
          );
        }
      }

      console.log("✅ Order items created");

      // Clear cart
      await client.query("DELETE FROM cart_items WHERE cart_id = $1", [
        cart.id,
      ]);
      await client.query(
        "UPDATE carts SET subtotal = 0, total = 0 WHERE id = $1",
        [cart.id],
      );

      console.log("✅ Cart cleared");

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: {
          ...order,
          subtotal: parseFloat(order.subtotal),
          shipping_cost: parseFloat(order.shipping_cost),
          tax: parseFloat(order.tax),
          total: parseFloat(order.total),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Create order error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create order",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get all orders for authenticated user
   * GET /api/orders
   */
  async getUserOrders(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { status, limit = 10, offset = 0 } = req.query;

      let query = `
        SELECT 
          o.*,
          COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = $1
      `;
      const params = [userId];

      if (status) {
        query += ` AND o.order_status = $${params.length + 1}`;
        params.push(status);
      }

      query += `
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Get total count
      const countQuery = status
        ? "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND order_status = $2"
        : "SELECT COUNT(*) FROM orders WHERE user_id = $1";
      const countParams = status ? [userId, status] : [userId];
      const countResult = await client.query(countQuery, countParams);

      return res.json({
        success: true,
        data: {
          orders: result.rows.map((order) => ({
            ...order,
            subtotal: parseFloat(order.subtotal),
            shipping_cost: parseFloat(order.shipping_cost),
            tax: parseFloat(order.tax),
            total: parseFloat(order.total),
            item_count: parseInt(order.item_count),
          })),
          pagination: {
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });
    } catch (error) {
      console.error("Get user orders error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch orders",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get single order by ID
   * GET /api/orders/:id
   */
  async getOrderById(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get order
      const orderResult = await client.query(
        "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      const order = orderResult.rows[0];

      // Get order items
      const itemsResult = await client.query(
        `SELECT 
          oi.*,
          p.name as product_name,
          p.images as product_images
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1`,
        [id],
      );

      // Get payment info
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE order_id = $1",
        [id],
      );

      return res.json({
        success: false,
        data: {
          order: {
            ...order,
            subtotal: parseFloat(order.subtotal),
            shipping_cost: parseFloat(order.shipping_cost),
            tax: parseFloat(order.tax),
            total: parseFloat(order.total),
          },
          items: itemsResult.rows.map((item) => ({
            ...item,
            price: parseFloat(item.price),
          })),
          payment: paymentResult.rows[0]
            ? {
                ...paymentResult.rows[0],
                amount: parseFloat(paymentResult.rows[0].amount),
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Get order by ID error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch order",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  // ... REST OF THE METHODS FROM YOUR EXISTING CONTROLLER

  /**
   * Cancel order
   * PUT /api/orders/:id/cancel
   */
  async cancelOrder(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      const orderResult = await client.query(
        "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      const order = orderResult.rows[0];

      if (!["pending", "processing"].includes(order.order_status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Order cannot be cancelled in current status",
        });
      }

      await client.query(
        `UPDATE orders 
        SET order_status = 'cancelled', 
            notes = CONCAT(COALESCE(notes, ''), ' | Cancellation reason: ', $1)
        WHERE id = $2`,
        [reason || "Customer requested cancellation", id],
      );

      const itemsResult = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND item_type = 'product'",
        [id],
      );

      for (const item of itemsResult.rows) {
        if (item.product_id) {
          await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [item.quantity, item.product_id],
          );
        }
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Order cancelled successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Cancel order error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to cancel order",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }
  async getOrderByNumber(req, res) {
    const client = await db.pool.connect();
    try {
      const { orderNumber } = req.params;
      const userId = req.user.id;

      const orderResult = await client.query(
        "SELECT * FROM orders WHERE order_number = $1 AND user_id = $2",
        [orderNumber, userId],
      );

      if (orderResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      return res.json({ success: true, data: orderResult.rows[0] });
    } catch (error) {
      console.error("Get order by number error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch order" });
    } finally {
      client.release();
    }
  }

  async getAllOrders(req, res) {
    const client = await db.pool.connect();
    try {
      const {
        status,
        payment_status,
        limit = 10,
        offset = 0,
        search,
      } = req.query;
      let params = [];
      let conditions = [];

      if (status) {
        params.push(status);
        conditions.push(`o.order_status = $${params.length}`);
      }
      if (payment_status) {
        params.push(payment_status);
        conditions.push(`o.payment_status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`o.order_number ILIKE $${params.length}`);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      params.push(limit, offset);
      const result = await client.query(
        `SELECT o.*, COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      return res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("Get all orders error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch orders" });
    } finally {
      client.release();
    }
  }

  async updateOrderStatus(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { order_status, tracking_number, notes } = req.body;

      const result = await client.query(
        `UPDATE orders 
       SET order_status = $1,
           tracking_number = COALESCE($2, tracking_number),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
        [order_status, tracking_number || null, notes || null, id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Update order status error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update order" });
    } finally {
      client.release();
    }
  }

  async getOrderStats(req, res) {
    const client = await db.pool.connect();
    try {
      const { start_date, end_date } = req.query;
      const params = [];
      let dateFilter = "";

      if (start_date && end_date) {
        params.push(start_date, end_date);
        dateFilter = `WHERE created_at BETWEEN $1 AND $2`;
      }

      const result = await client.query(
        `SELECT
         COUNT(*) as total_orders,
         SUM(total) as total_revenue,
         COUNT(*) FILTER (WHERE order_status = 'pending') as pending,
         COUNT(*) FILTER (WHERE order_status = 'processing') as processing,
         COUNT(*) FILTER (WHERE order_status = 'completed') as completed,
         COUNT(*) FILTER (WHERE order_status = 'cancelled') as cancelled
       FROM orders ${dateFilter}`,
        params,
      );

      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Get order stats error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch stats" });
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderController();
