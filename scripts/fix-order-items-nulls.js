// fix-order-items-nulls.js
// Run with: node fix-order-items-nulls.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log("🔧 Fixing order_items NOT NULL constraints...\n");

    await client.query("BEGIN");

    // product_id should be nullable (null when item is a service)
    await client.query(`
      ALTER TABLE order_items 
      ALTER COLUMN product_id DROP NOT NULL
    `);
    console.log("✅ product_id now nullable");

    // product_name should be nullable (we use item_name instead)
    await client.query(`
      ALTER TABLE order_items 
      ALTER COLUMN product_name DROP NOT NULL
    `);
    console.log("✅ product_name now nullable");

    await client.query("COMMIT");

    // Verify
    console.log("\n=== FINAL order_items SCHEMA ===");
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position
    `);
    console.table(schema.rows);

    console.log("🎉 Done! Restart your server and retry checkout.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
