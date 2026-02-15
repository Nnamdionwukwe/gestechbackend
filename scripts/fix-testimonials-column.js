// fix-all-missing-columns.js
require("dotenv").config();
const db = require("../src/config/database");

async function addColumnSafely(tableName, columnName, columnDef) {
  try {
    console.log(`Adding ${columnName} to ${tableName}...`);
    await db.query(`
      ALTER TABLE ${tableName} 
      ADD COLUMN IF NOT EXISTS ${columnName} ${columnDef};
    `);
    console.log(`✅ ${columnName} added to ${tableName}\n`);
    return true;
  } catch (error) {
    if (error.code === "42P01") {
      console.log(`⚠️  Table ${tableName} doesn't exist, skipping...\n`);
      return false;
    }
    throw error;
  }
}

async function fixAllMissingColumns() {
  try {
    console.log("🔧 Fixing all missing columns...\n");

    // Add is_approved to testimonials
    await addColumnSafely(
      "testimonials",
      "is_approved",
      "BOOLEAN DEFAULT true",
    );

    // Add display_order to all tables
    await addColumnSafely("testimonials", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("services", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("portfolio", "display_order", "INTEGER DEFAULT 0");
    await addColumnSafely("team", "display_order", "INTEGER DEFAULT 0");

    // Verify
    console.log("Verifying testimonials columns...");
    const result = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
      AND column_name IN ('is_approved', 'display_order')
      ORDER BY column_name;
    `);

    console.log("\n📊 Testimonials columns:");
    result.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name} (${row.data_type}): ${row.column_default}`,
      );
    });

    console.log("\n✅ All columns added successfully!");
    console.log("🎉 You can now refresh your frontend!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing columns:", error);
    process.exit(1);
  }
}

fixAllMissingColumns();
