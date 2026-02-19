// src/controllers/paymentController.js
const db = require("../config/database");
const axios = require("axios");

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
        SELECT p.*, o.order_number, o.total as order_total
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.user_id = $1
      `;
      const params = [userId];

      if (status) {
        query += ` AND p.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await client.query(query, params);

      const countQuery = status
        ? "SELECT COUNT(*) FROM payments WHERE user_id = $1 AND status = $2"
        : "SELECT COUNT(*) FROM payments WHERE user_id = $1";
      const countParams = status ? [userId, status] : [userId];
      const countResult = await client.query(countQuery, countParams);

      return res.json({
        success: true,
        data: {
          payments: result.rows.map((p) => ({
            ...p,
            amount: parseFloat(p.amount),
            order_total: parseFloat(p.order_total),
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
      return res
        .status(500)
        .json({
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
        `SELECT p.*, o.order_number, o.total as order_total, o.order_status
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE p.id = $1 AND p.user_id = $2`,
        [id, userId],
      );

      if (result.rows.length === 0)
        return res
          .status(404)
          .json({ success: false, error: "Payment not found" });

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
      return res
        .status(500)
        .json({
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
        `SELECT p.*, o.order_number
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE p.order_id = $1 AND p.user_id = $2`,
        [orderId, userId],
      );

      if (result.rows.length === 0)
        return res
          .status(404)
          .json({ success: false, error: "Payment not found for this order" });

      return res.json({
        success: true,
        data: { ...result.rows[0], amount: parseFloat(result.rows[0].amount) },
      });
    } catch (error) {
      console.error("Get payment by order ID error:", error);
      return res
        .status(500)
        .json({
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
   * GET /api/payments/admin/all
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
        SELECT p.*, o.order_number, u.email as user_email, u.full_name as user_name
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
        query += ` AND (o.order_number ILIKE $${params.length} OR p.transaction_reference ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await client.query(query, params);

      let countQuery =
        "SELECT COUNT(*) FROM payments p JOIN orders o ON p.order_id = o.id JOIN users u ON p.user_id = u.id WHERE 1=1";
      const countParams = [];
      if (status) {
        countParams.push(status);
        countQuery += ` AND p.status = $${countParams.length}`;
      }
      if (payment_method) {
        countParams.push(payment_method);
        countQuery += ` AND p.payment_method = $${countParams.length}`;
      }
      if (search) {
        countParams.push(`%${search}%`);
        countQuery += ` AND (o.order_number ILIKE $${countParams.length} OR u.email ILIKE $${countParams.length})`;
      }

      const countResult = await client.query(countQuery, countParams);

      return res.json({
        success: true,
        data: {
          payments: result.rows.map((p) => ({
            ...p,
            amount: parseFloat(p.amount),
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
      return res
        .status(500)
        .json({
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
   * POST /api/payments/admin/:id/verify
   */
  async verifyPayment(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;

      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );
      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Payment not found" });
      }

      const payment = paymentResult.rows[0];

      if (payment.payment_method !== "paystack") {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            error: "Only Paystack payments can be verified automatically",
          });
      }

      const paystackRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${payment.paystack_reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const txData = paystackRes.data.data;

      if (txData.status === "success") {
        await client.query(
          `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP, paystack_data = $1 WHERE id = $2`,
          [JSON.stringify(txData), id],
        );
        await client.query(
          `UPDATE orders SET payment_status = 'paid', order_status = 'processing', paid_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [payment.order_id],
        );
        await client.query("COMMIT");
        return res.json({
          success: true,
          message: "Payment verified successfully",
          data: txData,
        });
      } else {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            error: "Payment verification failed",
            data: txData,
          });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Verify payment error:", error);
      return res
        .status(500)
        .json({
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
   * PUT /api/payments/admin/:id/status
   *
   * FIX: Replaced CASE $1 WHEN ... with explicit cast ::varchar to resolve
   * "inconsistent types deduced for parameter $1" (text vs varchar) error.
   */
  async updatePaymentStatus(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { status, notes } = req.body;

      const validStatuses = ["pending", "completed", "failed", "refunded"];
      if (!status || !validStatuses.includes(status)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            error: `Status must be one of: ${validStatuses.join(", ")}`,
          });
      }

      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );
      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Payment not found" });
      }

      const payment = paymentResult.rows[0];

      // Build update cleanly — no CASE with $1 to avoid type inference issues
      const setParts = ["status = $1::varchar", "updated_at = NOW()"];
      const params = [status];

      if (status === "completed") {
        setParts.push("paid_at = COALESCE(paid_at, NOW())");
      }
      if (notes) {
        params.push(notes);
        setParts.push(`failure_reason = $${params.length}::text`);
      }

      params.push(id);
      await client.query(
        `UPDATE payments SET ${setParts.join(", ")} WHERE id = $${params.length}`,
        params,
      );

      // Map payment status → order statuses (avoid CASE $1 WHEN pattern)
      const orderPaymentStatus =
        { completed: "paid", failed: "failed", refunded: "refunded" }[status] ||
        "pending";
      const orderStatus = { completed: "processing", failed: "cancelled" }[
        status
      ];

      if (orderStatus) {
        await client.query(
          `UPDATE orders SET payment_status = $1::varchar, order_status = $2::varchar WHERE id = $3`,
          [orderPaymentStatus, orderStatus, payment.order_id],
        );
      } else {
        await client.query(
          `UPDATE orders SET payment_status = $1::varchar WHERE id = $2`,
          [orderPaymentStatus, payment.order_id],
        );
      }

      await client.query("COMMIT");
      return res.json({
        success: true,
        message: "Payment status updated successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update payment status error:", error);
      return res
        .status(500)
        .json({
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
   * GET /api/payments/admin/stats
   */
  async getPaymentStats(req, res) {
    const client = await db.pool.connect();
    try {
      const { start_date, end_date } = req.query;
      const params = [];
      let dateFilter = "";

      if (start_date && end_date) {
        params.push(start_date, end_date);
        dateFilter = "WHERE created_at BETWEEN $1 AND $2";
      }

      const statsResult = await client.query(
        `SELECT
           COUNT(*)                                                              AS total_payments,
           COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)         AS total_revenue,
           COUNT(*) FILTER (WHERE status = 'pending')                           AS pending_payments,
           COUNT(*) FILTER (WHERE status = 'completed')                         AS completed_payments,
           COUNT(*) FILTER (WHERE status = 'failed')                            AS failed_payments,
           COUNT(*) FILTER (WHERE status = 'refunded')                          AS refunded_payments,
           COALESCE(AVG(amount) FILTER (WHERE status = 'completed'), 0)         AS average_payment_value
         FROM payments ${dateFilter}`,
        params,
      );

      const paymentMethodResult = await client.query(
        `SELECT
           payment_method,
           COUNT(*)                                                              AS count,
           COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)         AS total_amount,
           COUNT(*) FILTER (WHERE status = 'completed')                         AS successful_count,
           COUNT(*) FILTER (WHERE status = 'failed')                            AS failed_count
         FROM payments ${dateFilter}
         GROUP BY payment_method`,
        params,
      );

      const dailyRevenueResult = await client.query(`
        SELECT
          DATE(created_at)                                                        AS date,
          COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)           AS revenue,
          COUNT(*)                                                                AS payment_count
        FROM payments
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      const row = statsResult.rows[0];
      return res.json({
        success: true,
        data: {
          stats: {
            total_payments: parseInt(row.total_payments),
            total_revenue: parseFloat(row.total_revenue),
            pending_payments: parseInt(row.pending_payments),
            completed_payments: parseInt(row.completed_payments),
            failed_payments: parseInt(row.failed_payments),
            refunded_payments: parseInt(row.refunded_payments),
            average_payment_value: parseFloat(
              parseFloat(row.average_payment_value).toFixed(2),
            ),
          },
          payment_methods: paymentMethodResult.rows.map((pm) => ({
            ...pm,
            count: parseInt(pm.count),
            total_amount: parseFloat(pm.total_amount),
            successful_count: parseInt(pm.successful_count),
            failed_count: parseInt(pm.failed_count),
          })),
          daily_revenue: dailyRevenueResult.rows.map((dr) => ({
            ...dr,
            revenue: parseFloat(dr.revenue),
            payment_count: parseInt(dr.payment_count),
          })),
        },
      });
    } catch (error) {
      console.error("Get payment stats error:", error);
      return res
        .status(500)
        .json({
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
   * POST /api/payments/admin/:id/refund
   */
  async refundPayment(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const { reason, amount } = req.body;

      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id],
      );
      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Payment not found" });
      }

      const payment = paymentResult.rows[0];

      if (payment.status !== "completed") {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            error: "Only completed payments can be refunded",
          });
      }

      const refundAmount = amount || payment.amount;
      if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            error: "Refund amount cannot exceed payment amount",
          });
      }

      // Attempt Paystack refund (non-fatal if it fails)
      if (
        payment.payment_method === "paystack" &&
        payment.transaction_reference
      ) {
        try {
          await axios.post(
            "https://api.paystack.co/refund",
            {
              transaction: payment.transaction_reference,
              amount: Math.round(parseFloat(refundAmount) * 100),
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );
        } catch (paystackError) {
          console.error(
            "Paystack refund error (non-fatal):",
            paystackError.response?.data,
          );
        }
      }

      await client.query(
        `UPDATE payments SET status = 'refunded', failure_reason = $1 WHERE id = $2`,
        [reason || "Refund processed", id],
      );
      await client.query(
        `UPDATE orders SET payment_status = 'refunded', order_status = 'cancelled' WHERE id = $1`,
        [payment.order_id],
      );

      // Restore product stock
      const items = await client.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND item_type = 'product'",
        [payment.order_id],
      );
      for (const item of items.rows) {
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
        message: "Refund processed successfully",
        data: { refund_amount: parseFloat(refundAmount), reason },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Refund payment error:", error);
      return res
        .status(500)
        .json({
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
