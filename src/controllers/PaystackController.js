// src/controllers/paystackController.js
const axios = require("axios");
const crypto = require("crypto");
const db = require("../config/database");

class PaystackController {
  /**
   * Initialize Paystack payment
   * POST /api/paystack/initialize
   */
  async initializePayment(req, res) {
    try {
      const { orderId, email, amount } = req.body;
      const userId = req.user.id;

      if (!orderId || !email || !amount) {
        return res.status(400).json({
          success: false,
          error: "Order ID, email, and amount are required",
        });
      }

      // Convert amount to kobo (Paystack uses kobo)
      const amountInKobo = Math.round(parseFloat(amount) * 100);

      // Generate unique reference
      const reference = `GTC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Initialize payment with Paystack
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: amountInKobo,
          reference,
          currency: "NGN",
          callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
          metadata: {
            order_id: orderId,
            user_id: userId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        // Save payment record
        await db.query(
          `INSERT INTO payments 
           (order_id, user_id, amount, payment_method, status, 
            paystack_reference, transaction_reference)
           VALUES ($1, $2, $3, 'paystack', 'pending', $4, $5)`,
          [orderId, userId, amount, reference, reference],
        );

        // ✅ Include public_key so the frontend can open the Paystack popup
        return res.json({
          success: true,
          data: {
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: reference,
            public_key: process.env.PAYSTACK_PUBLIC_KEY, // ← required for inline popup
          },
        });
      } else {
        throw new Error("Payment initialization failed");
      }
    } catch (error) {
      console.error("Initialize payment error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to initialize payment",
        message: error.response?.data?.message || error.message,
      });
    }
  }

  /**
   * Verify Paystack payment
   * GET /api/paystack/verify/:reference
   */
  async verifyPayment(req, res) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { reference } = req.params;
      const userId = req.user.id;

      // Verify with Paystack
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const transactionData = response.data.data;

      if (transactionData.status === "success") {
        // Update payment record
        await client.query(
          `UPDATE payments 
           SET status = 'completed',
               paid_at = CURRENT_TIMESTAMP,
               paystack_data = $1
           WHERE paystack_reference = $2 AND user_id = $3`,
          [JSON.stringify(transactionData), reference, userId],
        );

        // Get order details
        const paymentResult = await client.query(
          "SELECT order_id FROM payments WHERE paystack_reference = $1",
          [reference],
        );

        if (paymentResult.rows.length > 0) {
          const orderId = paymentResult.rows[0].order_id;

          // Update order status
          await client.query(
            `UPDATE orders 
             SET payment_status = 'paid',
                 order_status = 'processing',
                 paid_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [orderId],
          );
        }

        await client.query("COMMIT");

        return res.json({
          success: true,
          message: "Payment verified successfully",
          data: {
            reference: transactionData.reference,
            amount: transactionData.amount / 100,
            status: transactionData.status,
            paid_at: transactionData.paid_at,
          },
        });
      } else {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Payment verification failed",
          status: transactionData.status,
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
   * Handle Paystack webhook
   * POST /api/paystack/webhook
   */
  async handleWebhook(req, res) {
    const client = await db.pool.connect();
    try {
      // Verify webhook signature
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== req.headers["x-paystack-signature"]) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid signature" });
      }

      const event = req.body;

      switch (event.event) {
        case "charge.success": {
          await client.query("BEGIN");

          const reference = event.data.reference;
          const transactionData = event.data;

          await client.query(
            `UPDATE payments 
             SET status = 'completed',
                 paid_at = CURRENT_TIMESTAMP,
                 paystack_data = $1
             WHERE paystack_reference = $2`,
            [JSON.stringify(transactionData), reference],
          );

          const paymentResult = await client.query(
            "SELECT order_id FROM payments WHERE paystack_reference = $1",
            [reference],
          );

          if (paymentResult.rows.length > 0) {
            await client.query(
              `UPDATE orders 
               SET payment_status = 'paid',
                   order_status = 'processing'
               WHERE id = $1`,
              [paymentResult.rows[0].order_id],
            );
          }

          await client.query("COMMIT");
          break;
        }

        case "charge.failed":
          await client.query(
            `UPDATE payments 
             SET status = 'failed',
                 failure_reason = $1
             WHERE paystack_reference = $2`,
            [event.data.gateway_response, event.data.reference],
          );
          break;

        default:
          console.log("Unhandled webhook event:", event.event);
      }

      return res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Webhook error:", error);
      return res.status(500).json({
        success: false,
        error: "Webhook processing failed",
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get list of Nigerian banks
   * GET /api/paystack/banks
   */
  async getBanks(req, res) {
    try {
      const response = await axios.get("https://api.paystack.co/bank", {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      });

      return res.json({ success: true, data: response.data.data });
    } catch (error) {
      console.error("Get banks error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch banks",
        message: error.response?.data?.message || error.message,
      });
    }
  }

  /**
   * Verify bank account number
   * POST /api/paystack/verify-account
   */
  async verifyAccountNumber(req, res) {
    try {
      const { account_number, bank_code } = req.body;

      if (!account_number || !bank_code) {
        return res.status(400).json({
          success: false,
          error: "Account number and bank code are required",
        });
      }

      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      if (response.data.status) {
        return res.json({
          success: true,
          data: {
            account_number: response.data.data.account_number,
            account_name: response.data.data.account_name,
            bank_id: response.data.data.bank_id,
          },
        });
      } else {
        return res.status(404).json({
          success: false,
          error: "Account verification failed",
        });
      }
    } catch (error) {
      console.error("Verify account error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify account",
        message: error.response?.data?.message || error.message,
      });
    }
  }
}

module.exports = new PaystackController();
