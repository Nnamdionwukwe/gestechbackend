// database/seed-ecommerce.js
require("dotenv").config();
const db = require("../src/config/database");

async function seedEcommerceData() {
  console.log("🌱 Starting E-commerce Database Seeding...\n");

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // Clear existing data (optional - comment out if you don't want to clear)
    console.log("🗑️  Clearing existing e-commerce data...");
    await client.query(
      "TRUNCATE TABLE payments, order_items, orders, cart_items, carts, products RESTART IDENTITY CASCADE",
    );
    console.log("✅ Existing data cleared\n");

    // ========================================
    // SEED PRODUCTS
    // ========================================
    console.log("📦 Seeding products...");

    const productsResult = await client.query(`
      INSERT INTO products (name, description, price, stock, category, images)
      VALUES 
        -- Electronics
        ('iPhone 15 Pro Max', 'Latest Apple flagship with A17 Pro chip, 256GB storage, titanium design', 1299.99, 50, 'Electronics', 
         ARRAY['https://images.unsplash.com/photo-1696446702442-3821cb6b0c1e?w=400']),
        
        ('Samsung Galaxy S24 Ultra', 'Premium Android phone with S Pen, 200MP camera, 12GB RAM', 1199.99, 45, 'Electronics', 
         ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400']),
        
        ('MacBook Pro 16" M3', 'Powerful laptop with M3 Max chip, 36GB RAM, 1TB SSD', 2999.99, 30, 'Computers', 
         ARRAY['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400']),
        
        ('Dell XPS 15', 'Premium Windows laptop, Intel i9, 32GB RAM, 4K OLED display', 2299.99, 25, 'Computers', 
         ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400']),
        
        ('iPad Pro 12.9"', 'Powerful tablet with M2 chip, 256GB, Apple Pencil compatible', 1099.99, 60, 'Electronics', 
         ARRAY['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400']),
        
        ('Sony WH-1000XM5', 'Industry-leading noise cancellation headphones, 30hr battery', 399.99, 100, 'Audio', 
         ARRAY['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400']),
        
        ('AirPods Pro 2', 'Active noise cancellation, spatial audio, USB-C charging', 249.99, 150, 'Audio', 
         ARRAY['https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400']),
        
        ('Canon EOS R6 Mark II', 'Professional mirrorless camera, 24MP, 4K 60fps video', 2499.99, 20, 'Cameras', 
         ARRAY['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400']),
        
        ('DJI Mini 4 Pro', 'Compact drone with 4K camera, 34min flight time, obstacle avoidance', 799.99, 35, 'Cameras', 
         ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400']),
        
        ('Apple Watch Series 9', 'Advanced smartwatch with health tracking, GPS, cellular', 429.99, 80, 'Wearables', 
         ARRAY['https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400']),
        
        -- Gaming
        ('PlayStation 5', 'Next-gen gaming console, 825GB SSD, 4K gaming at 120fps', 499.99, 40, 'Gaming', 
         ARRAY['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400']),
        
        ('Xbox Series X', 'Microsoft flagship console, 1TB storage, Game Pass compatible', 499.99, 35, 'Gaming', 
         ARRAY['https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400']),
        
        ('Nintendo Switch OLED', 'Hybrid gaming console with 7" OLED screen, 64GB storage', 349.99, 70, 'Gaming', 
         ARRAY['https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400']),
        
        ('Logitech G Pro X Superlight', 'Ultra-lightweight wireless gaming mouse, 25K DPI sensor', 159.99, 90, 'Gaming', 
         ARRAY['https://images.unsplash.com/photo-1527814050087-3793815479db?w=400']),
        
        ('Razer BlackWidow V4', 'Mechanical gaming keyboard, RGB lighting, programmable keys', 189.99, 60, 'Gaming', 
         ARRAY['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400']),
        
        -- Home & Office
        ('LG C3 OLED 65"', '4K OLED TV with webOS, Dolby Vision, 120Hz for gaming', 1799.99, 25, 'Home Electronics', 
         ARRAY['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400']),
        
        ('Sonos Arc', 'Premium soundbar with Dolby Atmos, Wi-Fi streaming', 899.99, 40, 'Audio', 
         ARRAY['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400']),
        
        ('Herman Miller Aeron', 'Ergonomic office chair, fully adjustable, mesh back', 1395.99, 15, 'Furniture', 
         ARRAY['https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400']),
        
        ('Dyson V15 Detect', 'Cordless vacuum with laser detection, 60min runtime', 749.99, 45, 'Appliances', 
         ARRAY['https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400']),
        
        ('Nespresso Vertuo Next', 'Coffee machine with barcode technology, 5 cup sizes', 179.99, 85, 'Appliances', 
         ARRAY['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400']),
        
        -- Accessories
        ('Anker PowerCore 26800', 'High-capacity power bank, 3 USB ports, fast charging', 65.99, 200, 'Accessories', 
         ARRAY['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400']),
        
        ('Samsung T7 Portable SSD 2TB', 'Ultra-fast external SSD, USB 3.2, compact design', 199.99, 120, 'Storage', 
         ARRAY['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400']),
        
        ('Belkin 3-in-1 Wireless Charger', 'Charge iPhone, Apple Watch, AirPods simultaneously', 149.99, 75, 'Accessories', 
         ARRAY['https://images.unsplash.com/photo-1591290619762-c588f5a1e2da?w=400']),
        
        ('Cable Matters Thunderbolt 4 Cable', '6.6ft certified cable, 40Gbps speed, 100W charging', 39.99, 150, 'Accessories', 
         ARRAY['https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400']),
        
        ('Peak Design Everyday Backpack', 'Camera backpack, 20L, weatherproof, modular dividers', 259.99, 50, 'Accessories', 
         ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'])
      RETURNING id, name, price, stock, category;
    `);

    console.log(`✅ Created ${productsResult.rows.length} products`);
    productsResult.rows.forEach((product, index) => {
      if (index < 5) {
        // Show first 5
        console.log(
          `   - ${product.name} ($${product.price}) - ${product.stock} in stock`,
        );
      }
    });
    console.log(`   ... and ${productsResult.rows.length - 5} more\n`);

    // ========================================
    // GET OR CREATE TEST USER
    // ========================================
    console.log("👤 Checking for test user...");

    let testUser = await client.query(
      "SELECT id, email, full_name FROM users WHERE email = $1",
      ["customer@example.com"],
    );

    if (testUser.rows.length === 0) {
      console.log("   Creating test user...");
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("password123", 10);

      testUser = await client.query(
        `
        INSERT INTO users (email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name
      `,
        ["customer@example.com", hashedPassword, "Test Customer", "user", true],
      );
      console.log(
        `✅ Created test user: ${testUser.rows[0].email} / password123`,
      );
    } else {
      console.log(`✅ Using existing user: ${testUser.rows[0].email}`);
    }

    const userId = testUser.rows[0].id;

    // ========================================
    // SEED CART WITH ITEMS
    // ========================================
    console.log("\n🛒 Seeding cart...");

    const cartResult = await client.query(
      `
      INSERT INTO carts (user_id, subtotal, total)
      VALUES ($1, 0, 0)
      ON CONFLICT (user_id) DO UPDATE SET subtotal = 0, total = 0
      RETURNING id;
    `,
      [userId],
    );

    const cartId = cartResult.rows[0].id;

    // Add 3 items to cart
    const cartItems = [
      { productId: productsResult.rows[0].id, quantity: 1 }, // iPhone
      { productId: productsResult.rows[5].id, quantity: 2 }, // Sony Headphones
      { productId: productsResult.rows[6].id, quantity: 1 }, // AirPods
    ];

    let cartTotal = 0;
    for (const item of cartItems) {
      const product = productsResult.rows.find((p) => p.id === item.productId);
      await client.query(
        `
        INSERT INTO cart_items (cart_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (cart_id, product_id) 
        DO UPDATE SET quantity = $3, price = $4
      `,
        [cartId, item.productId, item.quantity, product.price],
      );
      cartTotal += parseFloat(product.price) * item.quantity;
    }

    // Update cart totals
    await client.query(
      "UPDATE carts SET subtotal = $1, total = $1 WHERE id = $2",
      [cartTotal, cartId],
    );

    console.log(
      `✅ Created cart with 3 items (Total: $${cartTotal.toFixed(2)})`,
    );

    // ========================================
    // SEED ORDERS
    // ========================================
    console.log("\n📋 Seeding orders...");

    // Order 1: Completed Paystack order
    const order1Number = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;
    const order1Total = 2299.99;

    const order1Result = await client.query(
      `
      INSERT INTO orders (
        order_number, user_id, subtotal, total,
        shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
        billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
        payment_method, payment_status, order_status, paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id, order_number;
    `,
      [
        order1Number,
        userId,
        order1Total,
        order1Total,
        "123 Main Street",
        "Lagos",
        "Lagos State",
        "Nigeria",
        "100001",
        "+2348012345678",
        "123 Main Street",
        "Lagos",
        "Lagos State",
        "Nigeria",
        "100001",
        "+2348012345678",
        "paystack",
        "paid",
        "delivered",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      ],
    );

    // Add order items for order 1
    await client.query(
      `
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
      VALUES 
        ($1, $2, $3, 1, 2299.99)
    `,
      [
        order1Result.rows[0].id,
        productsResult.rows[3].id,
        productsResult.rows[3].name,
      ],
    );

    // Add payment for order 1
    await client.query(
      `
      INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_reference, paystack_reference, paid_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        order1Result.rows[0].id,
        userId,
        order1Total,
        "paystack",
        "completed",
        order1Number,
        `PAY-${Math.random().toString(36).substr(2, 15).toUpperCase()}`,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      ],
    );

    console.log(`✅ Order 1: ${order1Number} - Delivered (Paystack)`);

    // Order 2: Pending Bank Transfer order
    const order2Number = `ORD-${Date.now() + 1}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;
    const order2Total = 1549.98;

    const order2Result = await client.query(
      `
      INSERT INTO orders (
        order_number, user_id, subtotal, total,
        shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
        billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
        payment_method, payment_status, order_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, order_number;
    `,
      [
        order2Number,
        userId,
        order2Total,
        order2Total,
        "456 Business Ave",
        "Abuja",
        "FCT",
        "Nigeria",
        "900001",
        "+2348023456789",
        "456 Business Ave",
        "Abuja",
        "FCT",
        "Nigeria",
        "900001",
        "+2348023456789",
        "bank_transfer",
        "pending",
        "pending",
      ],
    );

    // Add order items for order 2
    await client.query(
      `
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
      VALUES 
        ($1, $2, $3, 1, 1099.99),
        ($1, $4, $5, 1, 449.99)
    `,
      [
        order2Result.rows[0].id,
        productsResult.rows[4].id,
        productsResult.rows[4].name,
        productsResult.rows[9].id,
        productsResult.rows[9].name,
      ],
    );

    // Add payment for order 2
    await client.query(
      `
      INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_reference)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        order2Result.rows[0].id,
        userId,
        order2Total,
        "bank_transfer",
        "pending",
        order2Number,
      ],
    );

    console.log(`✅ Order 2: ${order2Number} - Pending (Bank Transfer)`);

    // Order 3: Processing Paystack order
    const order3Number = `ORD-${Date.now() + 2}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;
    const order3Total = 799.98;

    const order3Result = await client.query(
      `
      INSERT INTO orders (
        order_number, user_id, subtotal, total,
        shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
        billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
        payment_method, payment_status, order_status, tracking_number, paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id, order_number;
    `,
      [
        order3Number,
        userId,
        order3Total,
        order3Total,
        "789 Tech Plaza",
        "Port Harcourt",
        "Rivers",
        "Nigeria",
        "500001",
        "+2348034567890",
        "789 Tech Plaza",
        "Port Harcourt",
        "Rivers",
        "Nigeria",
        "500001",
        "+2348034567890",
        "paystack",
        "paid",
        "processing",
        `TRACK-${Math.random().toString(36).substr(2, 10).toUpperCase()}`,
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      ],
    );

    // Add order items for order 3
    await client.query(
      `
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
      VALUES 
        ($1, $2, $3, 2, 399.99)
    `,
      [
        order3Result.rows[0].id,
        productsResult.rows[5].id,
        productsResult.rows[5].name,
      ],
    );

    // Add payment for order 3
    await client.query(
      `
      INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_reference, paystack_reference, paid_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        order3Result.rows[0].id,
        userId,
        order3Total,
        "paystack",
        "completed",
        order3Number,
        `PAY-${Math.random().toString(36).substr(2, 15).toUpperCase()}`,
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      ],
    );

    console.log(
      `✅ Order 3: ${order3Number} - Processing (Paystack, with tracking)`,
    );

    await client.query("COMMIT");

    console.log("\n🎉 E-commerce Database Seeding Complete!");
    console.log("\n📊 Summary:");
    console.log(`   - Products: ${productsResult.rows.length}`);
    console.log(`   - Carts: 1 (with 3 items)`);
    console.log(`   - Orders: 3`);
    console.log(`   - Payments: 3`);
    console.log("\n🔐 Test Credentials:");
    console.log(
      `   Email: ${testUser.rows[0].email} (${testUser.rows[0].full_name})`,
    );
    console.log("   Password: password123");
    console.log("\n📋 Order Status:");
    console.log(`   - ${order1Number}: Delivered (Paid)`);
    console.log(`   - ${order2Number}: Pending (Bank Transfer)`);
    console.log(`   - ${order3Number}: Processing (Paid)`);

    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Database seeding failed:", error);
    console.error("\nError details:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedEcommerceData();
