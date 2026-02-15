// railway-db-fix.js
// Run this on Railway to fix missing database columns

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function addColumnSafely(tableName, columnName, columnDef) {
  try {
    console.log(`Adding ${columnName} to ${tableName}...`);
    await pool.query(`
      ALTER TABLE ${tableName} 
      ADD COLUMN IF NOT EXISTS ${columnName} ${columnDef};
    `);
    console.log(`✅ ${columnName} added to ${tableName}`);
    return true;
  } catch (error) {
    if (error.code === "42P01") {
      console.log(`⚠️  Table ${tableName} doesn't exist, skipping...`);
      return false;
    }
    throw error;
  }
}

async function fixDatabase() {
  try {
    console.log("🔧 Fixing Railway database columns...\n");

    await addColumnSafely(
      "testimonials",
      "is_approved",
      "BOOLEAN DEFAULT true",
    );
    await addColumnSafely("testimonials", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("services", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("portfolio", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("team", "display_order", "INTEGER DEFAULT 0");

    console.log("\n✅ All columns added successfully!");
    console.log("🎉 Railway backend should now work!\n");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixDatabase();
