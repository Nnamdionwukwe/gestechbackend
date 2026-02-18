// scripts/seedCart.js
require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) =>
    console.log(
      `\n${colors.cyan}${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}${colors.reset}\n`,
    ),
};

async function createCartTables() {
  const client = await pool.connect();
  try {
    log.section("Creating Cart Tables");

    // 1. Create carts table
    log.info("Creating carts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subtotal DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    log.success("carts table created");

    // 2. Create cart_items table
    log.info("Creating cart_items table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        service_variant_id INTEGER REFERENCES service_variants(id) ON DELETE CASCADE,
        item_type VARCHAR(20) CHECK (item_type IN ('product', 'service')),
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_item_reference CHECK (
          (item_type = 'product' AND product_id IS NOT NULL AND service_variant_id IS NULL) OR
          (item_type = 'service' AND service_variant_id IS NOT NULL AND product_id IS NULL)
        )
      );
    `);
    log.success("cart_items table created");

    // 3. Create indexes for performance
    log.info("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_service_variant_id ON cart_items(service_variant_id);
    `);
    log.success("Indexes created");
  } catch (error) {
    log.error(`Error creating tables: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function createServiceVariantsTable() {
  const client = await pool.connect();
  try {
    log.section("Creating Service Variants Table");

    log.info("Creating service_variants table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_variants (
        id SERIAL PRIMARY KEY,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        duration VARCHAR(100),
        features TEXT[],
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    log.success("service_variants table created");

    log.info("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_service_variants_service_id ON service_variants(service_id);
      CREATE INDEX IF NOT EXISTS idx_service_variants_active ON service_variants(is_active);
    `);
    log.success("Indexes created");
  } catch (error) {
    log.error(`Error creating service_variants table: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function seedServiceVariants() {
  const client = await pool.connect();
  try {
    log.section("Seeding Service Variants");

    // Get services
    const servicesResult = await client.query(`
      SELECT id, name, category FROM services WHERE is_active = true LIMIT 5
    `);

    if (servicesResult.rows.length === 0) {
      log.warning("No services found. Please seed services first.");
      return;
    }

    const variants = [
      {
        serviceName: "Web Development",
        variants: [
          {
            name: "Basic Website",
            description: "Perfect for small businesses and personal portfolios",
            price: 150000,
            duration: "2-3 weeks",
            features: [
              "5-10 Pages",
              "Responsive Design",
              "Basic SEO",
              "Contact Form",
              "1 Month Support",
            ],
          },
          {
            name: "E-Commerce Website",
            description: "Complete online store with payment integration",
            price: 500000,
            duration: "6-10 weeks",
            features: [
              "Product Management",
              "Payment Gateway",
              "Shopping Cart",
              "Order Management",
              "Customer Dashboard",
              "Analytics",
              "3 Months Support",
            ],
          },
          {
            name: "Enterprise Website",
            description: "Large-scale web applications with advanced features",
            price: 2000000,
            duration: "12-16 weeks",
            features: [
              "Custom Features",
              "Scalable Architecture",
              "Advanced Security",
              "API Integration",
              "Multi-language",
              "Performance Optimization",
              "6 Months Support",
            ],
          },
        ],
      },
      {
        serviceName: "Mobile App Development",
        variants: [
          {
            name: "Basic Mobile App",
            description: "Simple mobile application for iOS or Android",
            price: 300000,
            duration: "4-6 weeks",
            features: [
              "Single Platform",
              "Basic Features",
              "User Authentication",
              "Push Notifications",
              "2 Months Support",
            ],
          },
          {
            name: "Advanced Mobile App",
            description: "Feature-rich application for iOS and Android",
            price: 800000,
            duration: "8-12 weeks",
            features: [
              "iOS & Android",
              "Advanced Features",
              "Real-time Sync",
              "Offline Mode",
              "Payment Integration",
              "Analytics",
              "4 Months Support",
            ],
          },
        ],
      },
      {
        serviceName: "UI/UX Design",
        variants: [
          {
            name: "Design Sprint",
            description: "Quick design concepts and prototypes",
            price: 80000,
            duration: "1 week",
            features: [
              "5 Screens",
              "Wireframes",
              "Low-fi Prototype",
              "Basic Style Guide",
            ],
          },
          {
            name: "Complete Design Package",
            description: "Full design system with high-fidelity prototypes",
            price: 300000,
            duration: "3-4 weeks",
            features: [
              "20+ Screens",
              "High-fi Prototype",
              "Design System",
              "Icon Set",
              "Interactive Prototype",
              "Developer Handoff",
            ],
          },
        ],
      },
    ];

    for (const serviceData of variants) {
      // Find service by name
      const service = servicesResult.rows.find((s) =>
        s.name.toLowerCase().includes(serviceData.serviceName.toLowerCase()),
      );

      if (!service) {
        log.warning(`Service not found: ${serviceData.serviceName}`);
        continue;
      }

      log.info(`Adding variants for ${serviceData.serviceName}...`);

      for (let i = 0; i < serviceData.variants.length; i++) {
        const variant = serviceData.variants[i];

        await client.query(
          `
          INSERT INTO service_variants 
          (service_id, name, description, price, duration, features, display_order, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT DO NOTHING
        `,
          [
            service.id,
            variant.name,
            variant.description,
            variant.price,
            variant.duration,
            variant.features,
            i,
          ],
        );

        log.success(`  ✓ ${variant.name} - ₦${variant.price.toLocaleString()}`);
      }
    }

    log.success("\nService variants seeded successfully!");
  } catch (error) {
    log.error(`Error seeding service variants: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function createSampleCart() {
  const client = await pool.connect();
  try {
    log.section("Creating Sample Cart Data");

    // Get a test user (or create one)
    let userResult = await client.query(`
      SELECT id, email FROM users WHERE email = 'test@example.com' LIMIT 1
    `);

    let userId;
    if (userResult.rows.length === 0) {
      log.info("Creating test user...");
      const testUserResult = await client.query(
        `
        INSERT INTO users (id, email, password_hash, full_name, role)
        VALUES ($1, 'test@example.com', 'hashed_password', 'Test User', 'user')
        RETURNING id
      `,
        [uuidv4()],
      );
      userId = testUserResult.rows[0].id;
      log.success("Test user created");
    } else {
      userId = userResult.rows[0].id;
      log.info(`Using existing user: ${userResult.rows[0].email}`);
    }

    // Create cart
    log.info("Creating cart...");
    const cartResult = await client.query(
      `
      INSERT INTO carts (user_id, subtotal, total)
      VALUES ($1, 0, 0)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
      [userId],
    );
    const cartId = cartResult.rows[0].id;
    log.success(`Cart created with ID: ${cartId}`);

    // Add service variants to cart
    const variantsResult = await client.query(`
      SELECT id, name, price FROM service_variants WHERE is_active = true LIMIT 2
    `);

    if (variantsResult.rows.length > 0) {
      log.info("Adding service variants to cart...");

      for (const variant of variantsResult.rows) {
        await client.query(
          `
          INSERT INTO cart_items (cart_id, service_variant_id, item_type, quantity, price)
          VALUES ($1, $2, 'service', 1, $3)
        `,
          [cartId, variant.id, variant.price],
        );

        log.success(
          `  ✓ Added: ${variant.name} - ₦${parseFloat(variant.price).toLocaleString()}`,
        );
      }
    }

    // Add products to cart (if products exist)
    const productsResult = await client.query(`
      SELECT id, name, price FROM products WHERE is_active = true LIMIT 2
    `);

    if (productsResult.rows.length > 0) {
      log.info("Adding products to cart...");

      for (const product of productsResult.rows) {
        await client.query(
          `
          INSERT INTO cart_items (cart_id, product_id, item_type, quantity, price)
          VALUES ($1, $2, 'product', 1, $3)
        `,
          [cartId, product.id, product.price],
        );

        log.success(
          `  ✓ Added: ${product.name} - ₦${parseFloat(product.price).toLocaleString()}`,
        );
      }
    }

    // Update cart totals
    log.info("Calculating cart totals...");
    await client.query(
      `
      UPDATE carts 
      SET subtotal = (SELECT COALESCE(SUM(quantity * price), 0) FROM cart_items WHERE cart_id = $1),
          total = (SELECT COALESCE(SUM(quantity * price), 0) FROM cart_items WHERE cart_id = $1)
      WHERE id = $1
    `,
      [cartId],
    );
    log.success("Cart totals updated");

    // Display cart summary
    const summaryResult = await client.query(
      `
      SELECT 
        c.id,
        c.subtotal,
        c.total,
        COUNT(ci.id) as item_count
      FROM carts c
      LEFT JOIN cart_items ci ON c.id = ci.cart_id
      WHERE c.id = $1
      GROUP BY c.id, c.subtotal, c.total
    `,
      [cartId],
    );

    const summary = summaryResult.rows[0];
    log.section("Cart Summary");
    console.log(`Cart ID: ${summary.id}`);
    console.log(`Items: ${summary.item_count}`);
    console.log(`Subtotal: ₦${parseFloat(summary.subtotal).toLocaleString()}`);
    console.log(`Total: ₦${parseFloat(summary.total).toLocaleString()}`);
  } catch (error) {
    log.error(`Error creating sample cart: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function viewCartData() {
  const client = await pool.connect();
  try {
    log.section("Viewing Cart Data");

    // Get all carts with items
    const result = await client.query(`
      SELECT 
        c.id as cart_id,
        c.user_id,
        u.email,
        c.subtotal,
        c.total,
        COUNT(ci.id) as item_count,
        json_agg(
          json_build_object(
            'id', ci.id,
            'type', ci.item_type,
            'name', COALESCE(p.name, sv.name),
            'quantity', ci.quantity,
            'price', ci.price
          )
        ) as items
      FROM carts c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN cart_items ci ON c.id = ci.cart_id
      LEFT JOIN products p ON ci.product_id = p.id
      LEFT JOIN service_variants sv ON ci.service_variant_id = sv.id
      GROUP BY c.id, c.user_id, u.email, c.subtotal, c.total
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      log.warning("No carts found in database");
      return;
    }

    result.rows.forEach((cart, index) => {
      console.log(`\n${colors.cyan}Cart ${index + 1}:${colors.reset}`);
      console.log(`  User: ${cart.email}`);
      console.log(`  Items: ${cart.item_count}`);
      console.log(`  Total: ₦${parseFloat(cart.total).toLocaleString()}`);

      if (cart.items && cart.items[0]) {
        console.log(`  ${colors.yellow}Items:${colors.reset}`);
        cart.items.forEach((item) => {
          if (item.id) {
            console.log(
              `    - ${item.name} (${item.type}) x${item.quantity} = ₦${parseFloat(item.price).toLocaleString()}`,
            );
          }
        });
      }
    });
  } catch (error) {
    log.error(`Error viewing cart data: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function testDatabaseConnection() {
  log.section("Testing Database Connection");
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW(), version()");
    log.success("Database connected successfully!");
    console.log(`Time: ${result.rows[0].now}`);
    console.log(`PostgreSQL: ${result.rows[0].version.split(" ")[1]}`);
    client.release();
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    return false;
  }
}

async function checkExistingTables() {
  const client = await pool.connect();
  try {
    log.section("Checking Existing Tables");

    const tables = [
      "users",
      "services",
      "products",
      "service_variants",
      "carts",
      "cart_items",
    ];

    for (const table of tables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `,
        [table],
      );

      const exists = result.rows[0].exists;
      if (exists) {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM ${table}`,
        );
        log.success(`${table}: ${countResult.rows[0].count} records`);
      } else {
        log.warning(`${table}: does not exist`);
      }
    }
  } catch (error) {
    log.error(`Error checking tables: ${error.message}`);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log(`
${colors.cyan}╔════════════════════════════════════════╗
║     Cart Database Seeding Script       ║
╚════════════════════════════════════════╝${colors.reset}
    `);

    // Test connection
    const connected = await testDatabaseConnection();
    if (!connected) {
      log.error("Cannot proceed without database connection");
      process.exit(1);
    }

    // Check existing tables
    await checkExistingTables();

    // Ask user what to do
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query) =>
      new Promise((resolve) => readline.question(query, resolve));

    console.log(`
${colors.yellow}What would you like to do?${colors.reset}
1. Create cart tables only
2. Create service_variants table
3. Seed service variants
4. Create sample cart
5. View existing cart data
6. Full setup (all of the above)
0. Exit
    `);

    const choice = await question("Enter your choice (0-6): ");

    switch (choice.trim()) {
      case "1":
        await createCartTables();
        break;
      case "2":
        await createServiceVariantsTable();
        break;
      case "3":
        await seedServiceVariants();
        break;
      case "4":
        await createSampleCart();
        break;
      case "5":
        await viewCartData();
        break;
      case "6":
        await createServiceVariantsTable();
        await createCartTables();
        await seedServiceVariants();
        await createSampleCart();
        await viewCartData();
        break;
      case "0":
        log.info("Exiting...");
        break;
      default:
        log.error("Invalid choice");
    }

    readline.close();

    log.section("Script Complete!");
    process.exit(0);
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
