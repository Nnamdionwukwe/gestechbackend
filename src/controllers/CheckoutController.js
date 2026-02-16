const axios = require("axios");
const pool = require("../config/database");

class CheckoutController {
  /**
   * Initialize checkout and get cart summary
   * GET /api/checkout
   */
  async getCheckoutSummary(req, res) {
    const client = await pool.connect();
    try {
      const userId = req.user.id;

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (
        cartResult.rows.length === 0 ||
        parseFloat(cartResult.rows[0].total) === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      const cart = cartResult.rows[0];

      // Get cart items with product details
      const itemsResult = await client.query(
        `
        SELECT 
          ci.id, ci.quantity, ci.price,
          p.id as product_id, p.name, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = $1
      `,
        [cart.id],
      );

      // Verify stock availability
      for (const item of itemsResult.rows) {
        if (item.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name}`,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          items: itemsResult.rows.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price),
          })),
          subtotal: parseFloat(cart.subtotal),
          total: parseFloat(cart.total),
          itemCount: itemsResult.rows.length,
        },
      });
    } catch (error) {
      console.error("Checkout summary error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching checkout summary",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Process checkout with bank transfer
   * POST /api/checkout/bank-transfer
   */
  async bankTransferCheckout(req, res) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { shippingAddress, billingAddress, notes } = req.body;

      // Validate required fields
      if (
        !shippingAddress ||
        !shippingAddress.address ||
        !shippingAddress.city
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Shipping address is required",
        });
      }

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (
        cartResult.rows.length === 0 ||
        parseFloat(cartResult.rows[0].total) === 0
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      const cart = cartResult.rows[0];

      // Get cart items
      const itemsResult = await client.query(
        `
        SELECT 
          ci.*, p.name, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = $1
      `,
        [cart.id],
      );

      // Verify stock
      for (const item of itemsResult.rows) {
        if (item.stock < item.quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name}`,
          });
        }
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create order
      const billing = billingAddress || shippingAddress;
      const orderResult = await client.query(
        `
        INSERT INTO orders (
          order_number, user_id, subtotal, total,
          shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
          billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
          payment_method, payment_status, order_status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `,
        [
          orderNumber,
          userId,
          cart.subtotal,
          cart.total,
          shippingAddress.address,
          shippingAddress.city,
          shippingAddress.state,
          shippingAddress.country || "Nigeria",
          shippingAddress.postalCode,
          shippingAddress.phone,
          billing.address,
          billing.city,
          billing.state,
          billing.country || "Nigeria",
          billing.postalCode,
          billing.phone,
          "bank_transfer",
          "pending",
          "pending",
          notes,
        ],
      );

      const order = orderResult.rows[0];

      // Create order items
      for (const item of itemsResult.rows) {
        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [order.id, item.product_id, item.name, item.quantity, item.price],
        );
      }

      // Create payment record
      const paymentResult = await client.query(
        `
        INSERT INTO payments (order_id, user_id, amount, payment_method, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [order.id, userId, cart.total, "bank_transfer", "pending"],
      );

      const payment = paymentResult.rows[0];

      // Update product stock
      for (const item of itemsResult.rows) {
        await client.query(
          "UPDATE products SET stock = stock - $1 WHERE id = $2",
          [item.quantity, item.product_id],
        );
      }

      // Clear cart
      await client.query("DELETE FROM cart_items WHERE cart_id = $1", [
        cart.id,
      ]);
      await client.query(
        "UPDATE carts SET subtotal = 0, total = 0 WHERE id = $1",
        [cart.id],
      );

      await client.query("COMMIT");

      // Bank transfer instructions
      const bankDetails = {
        bankName: process.env.BANK_NAME || "First Bank of Nigeria",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "1234567890",
        accountName: process.env.BANK_ACCOUNT_NAME || "Your Company Name",
        amount: parseFloat(cart.total),
        reference: order.order_number,
      };

      return res.status(201).json({
        success: true,
        message:
          "Order created successfully. Please complete payment via bank transfer.",
        data: {
          order: {
            id: order.id,
            order_number: order.order_number,
            total: parseFloat(order.total),
            payment_status: order.payment_status,
            order_status: order.order_status,
          },
          payment: {
            id: payment.id,
            amount: parseFloat(payment.amount),
            status: payment.status,
          },
          bankDetails,
          instructions:
            "Please transfer the exact amount to the bank account provided and use the order number as your payment reference. Your order will be processed once payment is confirmed.",
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Bank transfer checkout error:", error);
      return res.status(500).json({
        success: false,
        message: "Error processing checkout",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Initialize Paystack payment
   * POST /api/checkout/paystack/initialize
   */
  async initializePaystackPayment(req, res) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userId = req.user.id;
      const { email, shippingAddress, billingAddress, notes } = req.body;

      // Validate required fields
      if (!email) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      if (
        !shippingAddress ||
        !shippingAddress.address ||
        !shippingAddress.city
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Shipping address is required",
        });
      }

      const cartResult = await client.query(
        "SELECT * FROM carts WHERE user_id = $1",
        [userId],
      );

      if (
        cartResult.rows.length === 0 ||
        parseFloat(cartResult.rows[0].total) === 0
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      const cart = cartResult.rows[0];

      // Get cart items
      const itemsResult = await client.query(
        `
        SELECT 
          ci.*, p.name, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = $1
      `,
        [cart.id],
      );

      // Verify stock
      for (const item of itemsResult.rows) {
        if (item.stock < item.quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name}`,
          });
        }
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create order
      const billing = billingAddress || shippingAddress;
      const orderResult = await client.query(
        `
        INSERT INTO orders (
          order_number, user_id, subtotal, total,
          shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
          billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
          payment_method, payment_status, order_status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `,
        [
          orderNumber,
          userId,
          cart.subtotal,
          cart.total,
          shippingAddress.address,
          shippingAddress.city,
          shippingAddress.state,
          shippingAddress.country || "Nigeria",
          shippingAddress.postalCode,
          shippingAddress.phone,
          billing.address,
          billing.city,
          billing.state,
          billing.country || "Nigeria",
          billing.postalCode,
          billing.phone,
          "paystack",
          "pending",
          "pending",
          notes,
        ],
      );

      const order = orderResult.rows[0];

      // Create order items
      for (const item of itemsResult.rows) {
        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [order.id, item.product_id, item.name, item.quantity, item.price],
        );
      }

      // Initialize Paystack transaction
      const paystackResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: Math.round(parseFloat(cart.total) * 100), // Paystack expects amount in kobo
          reference: order.order_number,
          callback_url: `${process.env.FRONTEND_URL}/checkout/verify`,
          metadata: {
            orderId: order.id.toString(),
            userId: userId.toString(),
            custom_fields: [
              {
                display_name: "Order Number",
                variable_name: "order_number",
                value: order.order_number,
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Create payment record
      await client.query(
        `
        INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_reference, paystack_reference)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          order.id,
          userId,
          cart.total,
          "paystack",
          "pending",
          order.order_number,
          paystackResponse.data.data.reference,
        ],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Payment initialized successfully",
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          authorizationUrl: paystackResponse.data.data.authorization_url,
          accessCode: paystackResponse.data.data.access_code,
          reference: paystackResponse.data.data.reference,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Paystack initialization error:", error);
      return res.status(500).json({
        success: false,
        message: "Error initializing payment",
        error: error.response?.data?.message || error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Verify Paystack payment
   * GET /api/checkout/paystack/verify/:reference
   */
  async verifyPaystackPayment(req, res) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { reference } = req.params;

      // Verify transaction with Paystack
      const paystackResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const transactionData = paystackResponse.data.data;

      // Find order
      const orderResult = await client.query(
        "SELECT * FROM orders WHERE order_number = $1",
        [reference],
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      const order = orderResult.rows[0];

      // Find payment record
      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE order_id = $1",
        [order.id],
      );

      const payment = paymentResult.rows[0];

      if (transactionData.status === "success") {
        // Update order
        await client.query(
          `
          UPDATE orders 
          SET payment_status = 'paid', order_status = 'processing', paid_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
          [order.id],
        );

        // Update payment
        if (payment) {
          await client.query(
            `
            UPDATE payments 
            SET status = 'completed', paid_at = CURRENT_TIMESTAMP, paystack_data = $1
            WHERE id = $2
          `,
            [JSON.stringify(transactionData), payment.id],
          );
        }

        // Update product stock and clear cart
        const cartResult = await client.query(
          "SELECT * FROM carts WHERE user_id = $1",
          [order.user_id],
        );

        if (cartResult.rows.length > 0) {
          const cart = cartResult.rows[0];

          const itemsResult = await client.query(
            "SELECT * FROM cart_items WHERE cart_id = $1",
            [cart.id],
          );

          if (itemsResult.rows.length > 0) {
            for (const item of itemsResult.rows) {
              await client.query(
                "UPDATE products SET stock = stock - $1 WHERE id = $2",
                [item.quantity, item.product_id],
              );
            }

            // Clear cart
            await client.query("DELETE FROM cart_items WHERE cart_id = $1", [
              cart.id,
            ]);
            await client.query(
              "UPDATE carts SET subtotal = 0, total = 0 WHERE id = $1",
              [cart.id],
            );
          }
        }

        await client.query("COMMIT");

        return res.status(200).json({
          success: true,
          message: "Payment verified successfully",
          data: {
            order: {
              id: order.id,
              order_number: order.order_number,
              total: parseFloat(order.total),
              payment_status: "paid",
              order_status: "processing",
            },
            transactionData,
          },
        });
      } else {
        // Payment failed
        await client.query(
          "UPDATE orders SET payment_status = $1 WHERE id = $2",
          ["failed", order.id],
        );

        if (payment) {
          await client.query(
            "UPDATE payments SET status = $1, paystack_data = $2 WHERE id = $3",
            ["failed", JSON.stringify(transactionData), payment.id],
          );
        }

        await client.query("COMMIT");

        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
          data: { transactionData },
        });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Paystack verification error:", error);
      return res.status(500).json({
        success: false,
        message: "Error verifying payment",
        error: error.response?.data?.message || error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Paystack webhook handler
   * POST /api/checkout/paystack/webhook
   */
  async paystackWebhook(req, res) {
    const client = await pool.connect();
    try {
      const hash = require("crypto")
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== req.headers["x-paystack-signature"]) {
        return res.status(400).json({
          success: false,
          message: "Invalid signature",
        });
      }

      const event = req.body;

      // Handle charge.success event
      if (event.event === "charge.success") {
        await client.query("BEGIN");

        const reference = event.data.reference;
        const orderResult = await client.query(
          "SELECT * FROM orders WHERE order_number = $1",
          [reference],
        );

        if (orderResult.rows.length > 0) {
          const order = orderResult.rows[0];

          if (order.payment_status !== "paid") {
            await client.query(
              `
              UPDATE orders 
              SET payment_status = 'paid', order_status = 'processing', paid_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `,
              [order.id],
            );

            const paymentResult = await client.query(
              "SELECT * FROM payments WHERE order_id = $1",
              [order.id],
            );

            if (paymentResult.rows.length > 0) {
              await client.query(
                `
                UPDATE payments 
                SET status = 'completed', paid_at = CURRENT_TIMESTAMP, paystack_data = $1
                WHERE id = $2
              `,
                [JSON.stringify(event.data), paymentResult.rows[0].id],
              );
            }
          }
        }

        await client.query("COMMIT");
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Webhook error:", error);
      return res.status(500).json({
        success: false,
        message: "Webhook processing error",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Confirm bank transfer payment (Admin only)
   * PUT /api/checkout/bank-transfer/confirm/:orderId
   */
  async confirmBankTransfer(req, res) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { orderId } = req.params;
      const { transactionReference } = req.body;

      const orderResult = await client.query(
        "SELECT * FROM orders WHERE id = $1",
        [orderId],
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      const order = orderResult.rows[0];

      if (order.payment_method !== "bank_transfer") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "This order does not use bank transfer payment",
        });
      }

      await client.query(
        `
        UPDATE orders 
        SET payment_status = 'paid', order_status = 'processing', paid_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        [orderId],
      );

      const paymentResult = await client.query(
        "SELECT * FROM payments WHERE order_id = $1",
        [orderId],
      );

      if (paymentResult.rows.length > 0) {
        await client.query(
          `
          UPDATE payments 
          SET status = 'completed', paid_at = CURRENT_TIMESTAMP, transaction_reference = $1
          WHERE id = $2
        `,
          [transactionReference, paymentResult.rows[0].id],
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Bank transfer confirmed successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Confirm bank transfer error:", error);
      return res.status(500).json({
        success: false,
        message: "Error confirming payment",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }
}

module.exports = new CheckoutController();
