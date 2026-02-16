// database/setup-ecommerce.js
require("dotenv").config();
const db = require("../src/config/database");

async function setupEcommerceTables() {
  console.log("🚀 Starting E-commerce Database Setup...\n");

  try {
    // Products Table
    console.log("📦 Creating products table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        category VARCHAR(100) NOT NULL,
        images TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Products table created");

    // Carts Table
    console.log("🛒 Creating carts table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subtotal DECIMAL(10, 2) DEFAULT 0.00,
        total DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Carts table created");

    // Cart Items Table
    console.log("📝 Creating cart_items table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cart_id, product_id)
      );
    `);
    console.log("✅ Cart items table created");

    // Orders Table
    console.log("📋 Creating orders table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subtotal DECIMAL(10, 2) NOT NULL,
        shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
        tax DECIMAL(10, 2) DEFAULT 0.00,
        total DECIMAL(10, 2) NOT NULL,
        
        -- Shipping Address
        shipping_address VARCHAR(255) NOT NULL,
        shipping_city VARCHAR(100) NOT NULL,
        shipping_state VARCHAR(100) NOT NULL,
        shipping_country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
        shipping_postal_code VARCHAR(20),
        shipping_phone VARCHAR(20) NOT NULL,
        
        -- Billing Address
        billing_address VARCHAR(255) NOT NULL,
        billing_city VARCHAR(100) NOT NULL,
        billing_state VARCHAR(100) NOT NULL,
        billing_country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
        billing_postal_code VARCHAR(20),
        billing_phone VARCHAR(20) NOT NULL,
        
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('paystack', 'bank_transfer', 'cash_on_delivery')),
        payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
        order_status VARCHAR(50) DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        
        tracking_number VARCHAR(100),
        paid_at TIMESTAMP,
        delivered_at TIMESTAMP,
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Orders table created");

    // Order Items Table
    console.log("📦 Creating order_items table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity >= 1),
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Order items table created");

    // Payments Table
    console.log("💳 Creating payments table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('paystack', 'bank_transfer', 'cash_on_delivery')),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
        transaction_reference VARCHAR(255),
        paystack_reference VARCHAR(255),
        paystack_data JSONB,
        paid_at TIMESTAMP,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Payments table created");

    // Create Indexes
    console.log("\n📊 Creating indexes...");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_transaction_reference ON payments(transaction_reference);
      CREATE INDEX IF NOT EXISTS idx_payments_paystack_reference ON payments(paystack_reference);
    `);
    console.log("✅ All indexes created");

    // Create Update Triggers
    console.log("\n⚡ Creating update triggers...");

    await db.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    const tables = [
      "products",
      "carts",
      "cart_items",
      "orders",
      "order_items",
      "payments",
    ];

    for (const table of tables) {
      await db.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON ${table}
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log("✅ All triggers created");

    // Verify tables
    console.log("\n🔍 Verifying created tables...");
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('products', 'carts', 'cart_items', 'orders', 'order_items', 'payments')
      ORDER BY table_name;
    `);

    console.log("\n✅ Verified tables:");
    result.rows.forEach((row) => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log("\n🎉 E-commerce Database Setup Complete!");
    console.log("\n📊 Tables created:");
    console.log("   - products");
    console.log("   - carts");
    console.log("   - cart_items");
    console.log("   - orders");
    console.log("   - order_items");
    console.log("   - payments");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database setup failed:", error);
    console.error("\nError details:", error.message);
    process.exit(1);
  }
}

setupEcommerceTables();
