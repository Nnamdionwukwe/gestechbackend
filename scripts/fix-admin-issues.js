// fix-admin-issues.js
// Run with: node fix-admin-issues.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log("🔍 Checking which tables are missing is_active...\n");

    const suspects = [
      "services",
      "newsletter_subscribers",
      "users",
      "products",
    ];

    for (const table of suspects) {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'`,
        [table],
      );
      const colNames = cols.rows.map((r) => r.column_name);
      const hasIsActive = colNames.includes("is_active");
      console.log(
        `${hasIsActive ? "✅" : "❌"} ${table}.is_active: ${hasIsActive ? "EXISTS" : "MISSING"}`,
      );
    }

    console.log("\n🔧 Adding missing is_active columns...\n");
    await client.query("BEGIN");

    // Add is_active to newsletter_subscribers if missing
    await client.query(`
      ALTER TABLE newsletter_subscribers 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log("✅ newsletter_subscribers.is_active ensured");

    // Add is_active to services if missing
    await client.query(`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log("✅ services.is_active ensured");

    await client.query("COMMIT");
    console.log("\n✅ All column fixes applied!\n");

    // Verify
    console.log("=== VERIFICATION ===");
    for (const table of suspects) {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'is_active'`,
        [table],
      );
      console.log(`${cols.rows.length > 0 ? "✅" : "❌"} ${table}.is_active`);
    }

    // Check payments table
    console.log("\n=== PAYMENTS TABLE ===");
    const payments = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    if (payments.rows.length === 0) {
      console.log("❌ payments table does not exist — needs to be created");
    } else {
      console.log("✅ payments table exists with columns:");
      console.table(payments.rows);
    }

    console.log("\n🎉 Done! Restart your server.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
