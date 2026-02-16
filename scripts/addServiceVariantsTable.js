// database/add-service-variants-table.js
require("dotenv").config();
const db = require("../src/config/database");

async function addServiceVariantsTable() {
  console.log("🚀 Adding Service Variants Table...\n");

  try {
    // Check if table already exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'service_variants'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log("⚠️  service_variants table already exists!");
      console.log("   Skipping table creation...\n");
    } else {
      // Create service_variants table
      console.log("📋 Creating service_variants table...");
      await db.query(`
        CREATE TABLE service_variants (
          id SERIAL PRIMARY KEY,
          service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2),
          duration VARCHAR(100),
          features TEXT[],
          is_active BOOLEAN DEFAULT true,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ service_variants table created");

      // Create indexes
      console.log("📊 Creating indexes...");
      await db.query(`
        CREATE INDEX idx_service_variants_service_id ON service_variants(service_id);
      `);
      await db.query(`
        CREATE INDEX idx_service_variants_is_active ON service_variants(is_active);
      `);
      console.log("✅ Indexes created");

      // Create update trigger
      console.log("⚡ Creating update trigger...");
      await db.query(`
        CREATE TRIGGER update_service_variants_updated_at 
        BEFORE UPDATE ON service_variants
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `);
      console.log("✅ Trigger created\n");
    }

    // Update cart_items table to support service variants
    console.log("🔄 Updating cart_items table...");

    // Check if item_type column exists
    const columnExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'cart_items' 
        AND column_name = 'item_type'
      );
    `);

    if (columnExists.rows[0].exists) {
      console.log("⚠️  cart_items already updated with item_type column");
      console.log("   Skipping cart_items update...\n");
    } else {
      // Drop the old unique constraint if it exists
      console.log("   Removing old constraints...");
      await db.query(`
        ALTER TABLE cart_items 
        DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_key;
      `);

      // Add new columns
      console.log("   Adding new columns...");
      await db.query(`
        ALTER TABLE cart_items 
        ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'product',
        ADD COLUMN IF NOT EXISTS service_variant_id INTEGER REFERENCES service_variants(id) ON DELETE CASCADE;
      `);

      // Make product_id nullable
      await db.query(`
        ALTER TABLE cart_items 
        ALTER COLUMN product_id DROP NOT NULL;
      `);

      // Update existing rows
      console.log("   Updating existing data...");
      await db.query(`
        UPDATE cart_items 
        SET item_type = 'product' 
        WHERE item_type IS NULL;
      `);

      // Make item_type NOT NULL after setting defaults
      await db.query(`
        ALTER TABLE cart_items 
        ALTER COLUMN item_type SET NOT NULL;
      `);

      // Add check constraint
      console.log("   Adding validation constraints...");
      await db.query(`
        ALTER TABLE cart_items 
        ADD CONSTRAINT cart_items_item_type_check 
        CHECK (item_type IN ('product', 'service'));
      `);

      await db.query(`
        ALTER TABLE cart_items 
        ADD CONSTRAINT cart_items_valid_item_check 
        CHECK (
          (item_type = 'product' AND product_id IS NOT NULL AND service_variant_id IS NULL) OR
          (item_type = 'service' AND service_variant_id IS NOT NULL AND product_id IS NULL)
        );
      `);

      console.log("✅ cart_items table updated\n");
    }

    // Verify tables
    console.log("🔍 Verifying tables...");
    const verification = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('service_variants', 'cart_items')
      ORDER BY table_name;
    `);

    console.log("✅ Verified tables:");
    verification.rows.forEach((row) => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Show cart_items columns
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cart_items'
      ORDER BY ordinal_position;
    `);

    console.log("\n📋 cart_items columns:");
    columns.rows.forEach((col) => {
      console.log(
        `   - ${col.column_name} (${col.data_type}) ${col.is_nullable === "YES" ? "NULL" : "NOT NULL"}`,
      );
    });

    console.log("\n🎉 Service Variants Table Setup Complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Run: node database/seed-service-variants.js");
    console.log("   2. Update your controllers with the new versions");
    console.log("   3. Test the API endpoints\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    console.error("\nError details:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

addServiceVariantsTable();
