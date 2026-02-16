const pool = require("../src/config/database");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function seedDatabase() {
  console.log("🌱 Starting database seeding...\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clear existing data (optional - comment out if you don't want to clear)
    console.log("🗑️  Clearing existing data...");
    await client.query(
      "TRUNCATE TABLE payments, order_items, orders, cart_items, carts, products, users RESTART IDENTITY CASCADE",
    );

    // Seed Users
    console.log("👥 Seeding users...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const usersResult = await client.query(
      `
      INSERT INTO users (name, email, password, role, phone, street, city, state, country)
      VALUES 
        ('Admin User', 'admin@example.com', $1, 'admin', '+2348012345678', '123 Admin Street', 'Lagos', 'Lagos', 'Nigeria'),
        ('John Doe', 'john@example.com', $1, 'user', '+2348023456789', '456 Customer Ave', 'Abuja', 'FCT', 'Nigeria'),
        ('Jane Smith', 'jane@example.com', $1, 'user', '+2348034567890', '789 Buyer Lane', 'Port Harcourt', 'Rivers', 'Nigeria')
      RETURNING id, name, email, role;
    `,
      [hashedPassword],
    );

    console.log(`✅ Created ${usersResult.rows.length} users`);
    usersResult.rows.forEach((user) => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    });

    // Seed Products
    console.log("\n📦 Seeding products...");
    const productsResult = await client.query(`
      INSERT INTO products (name, description, price, stock, category, images)
      VALUES 
        ('iPhone 15 Pro', 'Latest Apple iPhone with A17 Pro chip', 1299.99, 50, 'Electronics', ARRAY['https://example.com/iphone15.jpg']),
        ('Samsung Galaxy S24', 'Flagship Samsung smartphone', 999.99, 45, 'Electronics', ARRAY['https://example.com/galaxy-s24.jpg']),
        ('MacBook Pro 16"', 'Powerful laptop for professionals', 2499.99, 30, 'Computers', ARRAY['https://example.com/macbook.jpg']),
        ('Sony WH-1000XM5', 'Premium noise-cancelling headphones', 349.99, 100, 'Audio', ARRAY['https://example.com/sony-headphones.jpg']),
        ('iPad Air', 'Versatile tablet for work and play', 599.99, 60, 'Electronics', ARRAY['https://example.com/ipad-air.jpg']),
        ('Nike Air Max', 'Comfortable running shoes', 129.99, 200, 'Fashion', ARRAY['https://example.com/nike-airmax.jpg']),
        ('Canon EOS R6', 'Professional mirrorless camera', 2499.00, 25, 'Cameras', ARRAY['https://example.com/canon-r6.jpg']),
        ('Dell UltraSharp Monitor', '27-inch 4K monitor', 549.99, 40, 'Computers', ARRAY['https://example.com/dell-monitor.jpg']),
        ('Logitech MX Master 3', 'Advanced wireless mouse', 99.99, 150, 'Accessories', ARRAY['https://example.com/logitech-mouse.jpg']),
        ('PlayStation 5', 'Next-gen gaming console', 499.99, 35, 'Gaming', ARRAY['https://example.com/ps5.jpg'])
      RETURNING id, name, price, stock, category;
    `);

    console.log(`✅ Created ${productsResult.rows.length} products`);
    productsResult.rows.forEach((product) => {
      console.log(
        `   - ${product.name} ($${product.price}) - ${product.stock} in stock`,
      );
    });

    // Seed Carts (for test users)
    console.log("\n🛒 Seeding carts...");
    const userId = usersResult.rows[1].id; // John Doe
    const productId1 = productsResult.rows[0].id; // iPhone
    const productId2 = productsResult.rows[3].id; // Headphones

    const cartResult = await client.query(
      `
      INSERT INTO carts (user_id, subtotal, total)
      VALUES ($1, 1649.98, 1649.98)
      RETURNING id;
    `,
      [userId],
    );

    const cartId = cartResult.rows[0].id;

    await client.query(
      `
      INSERT INTO cart_items (cart_id, product_id, quantity, price)
      VALUES 
        ($1, $2, 1, 1299.99),
        ($1, $3, 1, 349.99);
    `,
      [cartId, productId1, productId2],
    );

    console.log(`✅ Created cart with 2 items for user ${userId}`);

    // Seed Sample Order
    console.log("\n📋 Seeding sample order...");
    const orderNumber = `ORD-${Date.now()}-00001`;

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        order_number, user_id, subtotal, total,
        shipping_address, shipping_city, shipping_state, shipping_country, shipping_postal_code, shipping_phone,
        billing_address, billing_city, billing_state, billing_country, billing_postal_code, billing_phone,
        payment_method, payment_status, order_status
      )
      VALUES (
        $1, $2, 599.99, 599.99,
        '456 Customer Ave', 'Abuja', 'FCT', 'Nigeria', '900001', '+2348023456789',
        '456 Customer Ave', 'Abuja', 'FCT', 'Nigeria', '900001', '+2348023456789',
        'paystack', 'paid', 'processing'
      )
      RETURNING id, order_number;
    `,
      [orderNumber, userId],
    );

    const orderId = orderResult.rows[0].id;

    await client.query(
      `
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
      VALUES ($1, $2, 'iPad Air', 1, 599.99);
    `,
      [orderId, productsResult.rows[4].id],
    );

    await client.query(
      `
      INSERT INTO payments (order_id, user_id, amount, payment_method, status, transaction_reference, paid_at)
      VALUES ($1, $2, 599.99, 'paystack', 'completed', 'PAY-123456789', CURRENT_TIMESTAMP);
    `,
      [orderId, userId],
    );

    console.log(`✅ Created sample order: ${orderNumber}`);

    await client.query("COMMIT");

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Users: ${usersResult.rows.length}`);
    console.log(`   - Products: ${productsResult.rows.length}`);
    console.log(`   - Carts: 1`);
    console.log(`   - Orders: 1`);
    console.log("\n🔐 Test Credentials:");
    console.log("   Admin: admin@example.com / password123");
    console.log("   User:  john@example.com / password123");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Database seeding failed:", error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run seeding
seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
