const db = require("../config/database");
const axios = require("axios");
const crypto = require("crypto");

class PaymentController {
  /**
   * Get all payments for authenticated user
   * GET /api/payments
   */
  async getUserPayments(req, res) {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { status, limit = 10, offset = 0 } = req.query;

      let query = `
        SELECT 
          p.*,
          o.order_number,
          o.total as order_total
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.user_id = $1
      `;
      const params = [userId];

      if (status) {
        query += ` AND p.status = $${params.length + 1}`;
        params.push(status);
      }

      query += `
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Get total count
      const countQuery = status
        ? "SELECT COUNT(*) FROM payments WHERE user_id = $1 AND status = $2"
        : "SELECT COUNT(*) FROM payments WHERE user_id = $1";
      const countParams = status ? [userId, status] : [userId];
      const countResult = await client.query(countQuery, countParams);

      return res.json({
        success: true,
        data: {
          payments: result.rows.map((payment) => ({
            ...payment,
            amount: parseFloat(payment.amount),
            order_total: parseFloat(payment.order_total),
          })),
          pagination: {
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });
    } catch (error) {
      console.error("Get user payments error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch payments",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get single payment by ID
   * GET /api/payments/:id
   */
  async getPaymentById(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await client.query(
        `
        SELECT 
          p.*,
          o.order_number,
          o.total as order_total,
          o.order_status
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.id = $1 AND p.user_id = $2
      `,
        [id, userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      return res.json({
        success: true,
        data: {
          ...result.rows[0],
          amount: parseFloat(result.rows[0].amount),
          order_total: parseFloat(result.rows[0].order_total),
        },
      });
    } catch (error) {
      console.error("Get payment by ID error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch payment",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get payment by order ID
   * GET /api/payments/order/:orderId
   */
  async getPaymentByOrderId(req, res) {
    const client = await db.pool.connect();
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await client.query(
        `
        SELECT 
          p.*,
          o.order_number
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.order_id = $1 AND p.user_id = $2
      `,
        [orderId, userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Payment not found for this order",
        });
      }

      return res.json({
        success: true,
        data: {
          ...result.rows[0],
          amount: parseFloat(result.rows[0].amount),
        },
      });
    } catch (error) {
      console.error("Get payment by order ID error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch payment",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get all payments (Admin)
   * GET /api/admin/payments
   */
  async getAllPayments(req, res) {
    const client = await db.pool.connect();
    try {
      const {
        status,
        payment_method,
        limit = 20,
        offset = 0,
        search,
      } = req.query;

      let query = `
        SELECT 
          p.*,
          o.order_number,
          u.email as user_email,
          u.full_name as user_name
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        JOIN users u ON p.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND p.status = $${params.length}`;
      }

      if (payment_method) {
        params.push(payment_method);
        query += ` AND p.payment_method = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (o.order_number LIKE $${params.length} OR p.transaction_reference LIKE $${params.length} OR u.email LIKE $${params.length})`;
      }

      query += `
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) FROM payments p WHERE 1=1";
      const countParams = [];

      if (status) {
        countParams.push(status);
        countQuery += ` AND p.status = $${countParams.length}`;
      }

      if (payment_method) {
        countParams.push(payment_method);
        countQuery += ` AND p.payment_method = $${countParams.length}`;
      }

      const countResult = await client.query(countQuery, countParams);

      return res.json({
        success: true,
        data: {
          payments: result.rows.map((payment) => ({
            ...payment,
            amount: parseFloat(payment.amount),
          })),
          pagination: {
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });
    } catch (error) {
      console.error("Get all payments error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch payments",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Verify Paystack payment manually (Admin)
   * POST /api/admin/payments/:id/verify
   */
  async verifyPayment(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;

      // Get payment
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );

      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      const payment = paymentResult.rows[0];

      if (payment.payment_method === "paystack") {
        // Verify with Paystack
        const paystackResponse = await axios.get(
          `https://api.paystack.co/transaction/verify/${payment.paystack_reference}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          },
        );

        const transactionData = paystackResponse.data.data;

        if (transactionData.status === "success") {
          // Update payment
          await client.query(
            `
            UPDATE payments 
            SET status = 'completed', 
                paid_at = CURRENT_TIMESTAMP,
                paystack_data = $1
            WHERE id = $2
          `,
            [JSON.stringify(transactionData), id],
          );

          // Update order
          await client.query(
            `
            UPDATE orders 
            SET payment_status = 'paid',
                order_status = 'processing',
                paid_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
            [payment.order_id],
          );

          await client.query("COMMIT");

          return res.json({
            success: true,
            message: "Payment verified successfully",
            data: transactionData,
          });
        } else {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "Payment verification failed",
            data: transactionData,
          });
        }
      } else {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Only Paystack payments can be verified automatically",
        });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Verify payment error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify payment",
        message: error.response?.data?.message || error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Update payment status (Admin)
   * PUT /api/admin/payments/:id/status
   */
  async updatePaymentStatus(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { status, notes } = req.body;

      // Validate status
      const validStatuses = ["pending", "completed", "failed", "refunded"];
      if (!validStatuses.includes(status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Invalid payment status",
        });
      }

      // Get payment
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );

      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      const payment = paymentResult.rows[0];

      // Update payment
      const updateFields = ["status = $1"];
      const params = [status, id];
      let paramCount = 2;

      if (status === "completed") {
        updateFields.push("paid_at = CURRENT_TIMESTAMP");
      }

      if (notes) {
        params.splice(params.length - 1, 0, notes);
        updateFields.push(`failure_reason = $${paramCount++}`);
      }

      await client.query(
        `UPDATE payments SET ${updateFields.join(", ")} WHERE id = $${paramCount}`,
        params,
      );

      // Update order payment status
      let orderPaymentStatus = "pending";
      if (status === "completed") {
        orderPaymentStatus = "paid";
      } else if (status === "failed") {
        orderPaymentStatus = "failed";
      } else if (status === "refunded") {
        orderPaymentStatus = "refunded";
      }

      await client.query(
        `
        UPDATE orders 
        SET payment_status = $1,
            order_status = CASE 
              WHEN $1 = 'paid' THEN 'processing'
              WHEN $1 = 'failed' THEN 'cancelled'
              ELSE order_status
            END
        WHERE id = $2
      `,
        [orderPaymentStatus, payment.order_id],
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Payment status updated successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update payment status error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update payment status",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get payment statistics (Admin)
   * GET /api/admin/payments/stats
   */
  async getPaymentStats(req, res) {
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
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_payments,
          AVG(CASE WHEN status = 'completed' THEN amount END) as average_payment_value
        FROM payments
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
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
        FROM payments
        ${dateFilter}
        GROUP BY payment_method
      `,
        params,
      );

      // Daily revenue (last 30 days)
      const dailyRevenueResult = await client.query(
        `
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
          COUNT(*) as payment_count
        FROM payments
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
      );

      return res.json({
        success: true,
        data: {
          stats: {
            ...statsResult.rows[0],
            total_revenue: parseFloat(statsResult.rows[0].total_revenue) || 0,
            average_payment_value:
              parseFloat(statsResult.rows[0].average_payment_value) || 0,
          },
          payment_methods: paymentMethodResult.rows.map((pm) => ({
            ...pm,
            total_amount: parseFloat(pm.total_amount),
          })),
          daily_revenue: dailyRevenueResult.rows.map((dr) => ({
            ...dr,
            revenue: parseFloat(dr.revenue),
          })),
        },
      });
    } catch (error) {
      console.error("Get payment stats error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch payment statistics",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Process refund (Admin)
   * POST /api/admin/payments/:id/refund
   */
  async refundPayment(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { reason, amount } = req.body;

      // Get payment
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );

      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      const payment = paymentResult.rows[0];

      if (payment.status !== "completed") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Only completed payments can be refunded",
        });
      }

      const refundAmount = amount || payment.amount;

      if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Refund amount cannot exceed payment amount",
        });
      }

      // If Paystack payment, initiate refund through Paystack
      if (
        payment.payment_method === "paystack" &&
        payment.transaction_reference
      ) {
        try {
          const paystackResponse = await axios.post(
            "https://api.paystack.co/refund",
            {
              transaction: payment.transaction_reference,
              amount: Math.round(parseFloat(refundAmount) * 100), // Convert to kobo
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );

          console.log("Paystack refund response:", paystackResponse.data);
        } catch (paystackError) {
          console.error("Paystack refund error:", paystackError.response?.data);
          // Continue with manual refund even if Paystack fails
        }
      }

      // Update payment status
      await client.query(
        `
        UPDATE payments 
        SET status = 'refunded',
            failure_reason = $1
        WHERE id = $2
      `,
        [reason || "Refund processed", id],
      );

      // Update order
      await client.query(
        `
        UPDATE orders 
        SET payment_status = 'refunded',
            order_status = 'cancelled'
        WHERE id = $1
      `,
        [payment.order_id],
      );

      // Restore product stock
      const itemsResult = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
        [payment.order_id],
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
        message: "Refund processed successfully",
        data: {
          refund_amount: parseFloat(refundAmount),
          reason,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Refund payment error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to process refund",
        message: error.message,
      });
    } finally {
      client.release();
    }
  }
}

module.exports = new PaymentController();
