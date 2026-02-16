const db = require("../config/database");

class OrderController {
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
        `
        SELECT 
          oi.*,
          p.name as product_name,
          p.images as product_images
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `,
        [id],
      );

      // Get payment info
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE order_id = $1",
        [id],
      );

      return res.json({
        success: true,
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

  /**
   * Get order by order number
   * GET /api/orders/number/:orderNumber
   */
  async getOrderByNumber(req, res) {
    const client = await db.pool.connect();
    try {
      const { orderNumber } = req.params;
      const userId = req.user.id;

      // Get order
      const orderResult = await client.query(
        "SELECT * FROM orders WHERE order_number = $1 AND user_id = $2",
        [orderNumber, userId],
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
        `
        SELECT 
          oi.*,
          p.name as product_name,
          p.images as product_images
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `,
        [order.id],
      );

      return res.json({
        success: true,
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
        },
      });
    } catch (error) {
      console.error("Get order by number error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch order",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

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

      // Get order
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

      // Check if order can be cancelled
      if (!["pending", "processing"].includes(order.order_status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Order cannot be cancelled in current status",
        });
      }

      // Update order status
      await client.query(
        `
        UPDATE orders 
        SET order_status = 'cancelled', 
            notes = CONCAT(COALESCE(notes, ''), ' | Cancellation reason: ', $1)
        WHERE id = $2
      `,
        [reason || "Customer requested cancellation", id],
      );

      // Restore product stock
      const itemsResult = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
        [id],
      );

      for (const item of itemsResult.rows) {
        await client.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [item.quantity, item.product_id],
        );
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

  /**
   * Get all orders (Admin)
   * GET /api/admin/orders
   */
  async getAllOrders(req, res) {
    const client = await db.pool.connect();
    try {
      const {
        status,
        payment_status,
        limit = 20,
        offset = 0,
        search,
      } = req.query;

      let query = `
        SELECT 
          o.*,
          u.email as user_email,
          u.full_name as user_name,
          COUNT(oi.id) as item_count
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND o.order_status = $${params.length}`;
      }

      if (payment_status) {
        params.push(payment_status);
        query += ` AND o.payment_status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (o.order_number LIKE $${params.length} OR u.email LIKE $${params.length} OR u.full_name LIKE $${params.length})`;
      }

      query += `
        GROUP BY o.id, u.email, u.full_name
        ORDER BY o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) FROM orders o WHERE 1=1";
      const countParams = [];

      if (status) {
        countParams.push(status);
        countQuery += ` AND o.order_status = $${countParams.length}`;
      }

      if (payment_status) {
        countParams.push(payment_status);
        countQuery += ` AND o.payment_status = $${countParams.length}`;
      }

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
      console.error("Get all orders error:", error);
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
   * Update order status (Admin)
   * PUT /api/admin/orders/:id/status
   */
  async updateOrderStatus(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { order_status, tracking_number, notes } = req.body;

      // Validate status
      const validStatuses = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];
      if (!validStatuses.includes(order_status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Invalid order status",
        });
      }

      // Update order
      const updateFields = ["order_status = $1"];
      const params = [order_status, id];
      let paramCount = 2;

      if (order_status === "delivered") {
        updateFields.push("delivered_at = CURRENT_TIMESTAMP");
      }

      if (tracking_number) {
        params.splice(params.length - 1, 0, tracking_number);
        updateFields.push(`tracking_number = $${paramCount++}`);
      }

      if (notes) {
        params.splice(params.length - 1, 0, notes);
        updateFields.push(
          `notes = CONCAT(COALESCE(notes, ''), ' | ', $${paramCount++})`,
        );
      }

      await client.query(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE id = $${paramCount}`,
        params,
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Order status updated successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update order status error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update order status",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get order statistics (Admin)
   * GET /api/admin/orders/stats
   */
  async getOrderStats(req, res) {
    const client = await db.pool.connect();
    try {
      const { start_date, end_date } = req.query;

      let dateFilter = "";
      const params = [];

      if (start_date && end_date) {
        params.push(start_date, end_date);
        dateFilter = " WHERE created_at BETWEEN $1 AND $2";
      }

      // Overall stats
      const statsResult = await client.query(
        `
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_revenue,
          COUNT(CASE WHEN order_status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN order_status = 'processing' THEN 1 END) as processing_orders,
          COUNT(CASE WHEN order_status = 'shipped' THEN 1 END) as shipped_orders,
          COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_orders,
          AVG(total) as average_order_value
        FROM orders
        ${dateFilter}
      `,
        params,
      );

      // Payment method breakdown
      const paymentMethodResult = await client.query(
        `
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(total) as total_amount
        FROM orders
        ${dateFilter}
        GROUP BY payment_method
      `,
        params,
      );

      return res.json({
        success: true,
        data: {
          stats: {
            ...statsResult.rows[0],
            total_revenue: parseFloat(statsResult.rows[0].total_revenue) || 0,
            average_order_value:
              parseFloat(statsResult.rows[0].average_order_value) || 0,
          },
          payment_methods: paymentMethodResult.rows.map((pm) => ({
            ...pm,
            total_amount: parseFloat(pm.total_amount),
          })),
        },
      });
    } catch (error) {
      console.error("Get order stats error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch order statistics",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderController();
