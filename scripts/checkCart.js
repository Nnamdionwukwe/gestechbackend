// scripts/checkCart.js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkCartSystem() {
  console.log("\n🔍 Checking Cart System in Database...\n");

  try {
    const client = await pool.connect();

    // 1. Check if tables exist
    console.log("📋 TABLE STATUS:");
    console.log("─".repeat(60));

    const tables = [
      { name: "users", description: "User accounts" },
      { name: "services", description: "Service offerings" },
      { name: "service_variants", description: "Service pricing tiers" },
      { name: "products", description: "Physical products" },
      { name: "carts", description: "Shopping carts" },
      { name: "cart_items", description: "Cart items" },
    ];

    for (const table of tables) {
      try {
        const exists = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `,
          [table.name],
        );

        if (exists.rows[0].exists) {
          const count = await client.query(
            `SELECT COUNT(*) as count FROM ${table.name}`,
          );
          console.log(
            `✓ ${table.name.padEnd(20)} - ${count.rows[0].count} records`,
          );
        } else {
          console.log(`✗ ${table.name.padEnd(20)} - MISSING`);
        }
      } catch (err) {
        console.log(`✗ ${table.name.padEnd(20)} - ERROR: ${err.message}`);
      }
    }

    // 2. Check cart_items structure
    console.log("\n🛠️  CART_ITEMS STRUCTURE:");
    console.log("─".repeat(60));

    try {
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cart_items'
        ORDER BY ordinal_position
      `);

      columns.rows.forEach((col) => {
        console.log(
          `  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === "YES" ? "NULL" : "NOT NULL"}`,
        );
      });
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }

    // 3. Check for item_type column
    console.log("\n🔧 CHECKING item_type COLUMN:");
    console.log("─".repeat(60));

    try {
      const itemTypeExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'cart_items' AND column_name = 'item_type'
        )
      `);

      if (itemTypeExists.rows[0].exists) {
        console.log("✓ item_type column EXISTS");

        // Check distinct values
        const values = await client.query(`
          SELECT DISTINCT item_type, COUNT(*) as count 
          FROM cart_items 
          GROUP BY item_type
        `);

        if (values.rows.length > 0) {
          console.log("\n  Current values:");
          values.rows.forEach((row) => {
            console.log(`    - ${row.item_type}: ${row.count} items`);
          });
        } else {
          console.log("  (No items in cart yet)");
        }
      } else {
        console.log("✗ item_type column MISSING - needs migration!");
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }

    // 4. Check for service_variant_id column
    console.log("\n🔧 CHECKING service_variant_id COLUMN:");
    console.log("─".repeat(60));

    try {
      const variantIdExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'cart_items' AND column_name = 'service_variant_id'
        )
      `);

      if (variantIdExists.rows[0].exists) {
        console.log("✓ service_variant_id column EXISTS");
      } else {
        console.log("✗ service_variant_id column MISSING - needs migration!");
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }

    // 5. Sample cart data
    console.log("\n🛒 SAMPLE CART DATA:");
    console.log("─".repeat(60));

    try {
      const carts = await client.query(`
        SELECT 
          c.id,
          u.email,
          c.subtotal,
          c.total,
          COUNT(ci.id) as items
        FROM carts c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN cart_items ci ON c.id = ci.cart_id
        GROUP BY c.id, u.email, c.subtotal, c.total
        LIMIT 5
      `);

      if (carts.rows.length > 0) {
        carts.rows.forEach((cart, i) => {
          console.log(`${i + 1}. User: ${cart.email}`);
          console.log(
            `   Items: ${cart.items}, Total: ₦${parseFloat(cart.total).toLocaleString()}`,
          );
        });
      } else {
        console.log("  No carts found");
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }

    // 6. Service variants
    console.log("\n📦 SERVICE VARIANTS:");
    console.log("─".repeat(60));

    try {
      const variants = await client.query(`
        SELECT 
          sv.id,
          sv.name,
          sv.price,
          s.name as service_name
        FROM service_variants sv
        JOIN services s ON sv.service_id = s.id
        WHERE sv.is_active = true
        LIMIT 5
      `);

      if (variants.rows.length > 0) {
        variants.rows.forEach((v, i) => {
          console.log(`${i + 1}. ${v.service_name} - ${v.name}`);
          console.log(`   Price: ₦${parseFloat(v.price).toLocaleString()}`);
        });
      } else {
        console.log("  No service variants found - run seeder!");
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }

    // 7. Database info
    console.log("\n💾 DATABASE INFO:");
    console.log("─".repeat(60));

    const dbInfo = await client.query(
      "SELECT version(), current_database(), current_user",
    );
    console.log(`Database: ${dbInfo.rows[0].current_database}`);
    console.log(`User: ${dbInfo.rows[0].current_user}`);
    console.log(`PostgreSQL: ${dbInfo.rows[0].version.split(" ")[1]}`);

    client.release();
    console.log("\n✅ Check complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

checkCartSystem();
