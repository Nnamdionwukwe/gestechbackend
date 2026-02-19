// fix-cart-schema.js
// Run with: node fix-cart-schema.js
// This fixes the cart_items table schema mismatches found during debugging

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixSchema() {
  const client = await pool.connect();

  try {
    console.log("🔍 Checking current cart_items schema...\n");

    const schema = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cart_items'
      ORDER BY ordinal_position
    `);
    console.table(schema.rows);

    // Check what type service_variant_id currently is
    const svCol = schema.rows.find(
      (r) => r.column_name === "service_variant_id",
    );
    const productCol = schema.rows.find((r) => r.column_name === "product_id");
    const productFixCol = schema.rows.find(
      (r) => r.column_name === "product_id_fix",
    );

    console.log("\n🔧 Starting schema fixes...\n");

    await client.query("BEGIN");

    // ── Fix 1: Convert service_variant_id from integer → uuid ─────────────
    if (svCol && svCol.data_type === "integer") {
      console.log(
        "⚠️  service_variant_id is integer — need to check service_variants.id type first...",
      );

      const svIdType = await client.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'service_variants' AND column_name = 'id'
      `);

      const svIdDataType = svIdType.rows[0]?.data_type;
      console.log(`   service_variants.id type: ${svIdDataType}`);

      if (svIdDataType === "integer") {
        // service_variants uses integer IDs — cart_items should match, keep as integer
        console.log(
          "✅ service_variant_id is integer and service_variants.id is integer — types match, no change needed.",
        );
      } else if (svIdDataType === "uuid") {
        // Mismatch: service_variants uses UUID but cart_items uses integer
        console.log("🔧 Converting service_variant_id from integer to uuid...");

        // Drop FK if exists
        await client.query(`
          ALTER TABLE cart_items 
          DROP CONSTRAINT IF EXISTS cart_items_service_variant_id_fkey
        `);

        // Clear existing data to allow type change (or cast if possible)
        const existingRows = await client.query(
          "SELECT COUNT(*) FROM cart_items WHERE service_variant_id IS NOT NULL",
        );
        if (parseInt(existingRows.rows[0].count) > 0) {
          console.log(
            `   ⚠️  ${existingRows.rows[0].count} rows have service_variant_id — clearing to allow type change`,
          );
          await client.query(
            "UPDATE cart_items SET service_variant_id = NULL WHERE service_variant_id IS NOT NULL",
          );
        }

        await client.query(`
          ALTER TABLE cart_items 
          ALTER COLUMN service_variant_id TYPE uuid 
          USING service_variant_id::text::uuid
        `);

        // Re-add FK
        await client.query(`
          ALTER TABLE cart_items
          ADD CONSTRAINT cart_items_service_variant_id_fkey
          FOREIGN KEY (service_variant_id) REFERENCES service_variants(id)
        `);
        console.log("✅ service_variant_id converted to uuid with FK restored");
      }
    } else {
      console.log(`✅ service_variant_id is already ${svCol?.data_type}`);
    }

    // ── Fix 2: Consolidate product_id and product_id_fix ──────────────────
    if (productFixCol) {
      console.log(
        "\n🔧 Found product_id_fix column — consolidating with product_id...",
      );

      // Check if product_id_fix has any data
      const fixData = await client.query(
        "SELECT COUNT(*) FROM cart_items WHERE product_id_fix IS NOT NULL",
      );
      const fixCount = parseInt(fixData.rows[0].count);
      console.log(`   product_id_fix has ${fixCount} rows with data`);

      // Check what products.id type is
      const productsIdType = await client.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'id'
      `);
      const productsIdDataType = productsIdType.rows[0]?.data_type;
      console.log(`   products.id type: ${productsIdDataType}`);

      if (productsIdDataType === "uuid") {
        // products uses UUID — we should use product_id_fix, rename it to product_id
        console.log(
          "🔧 products.id is UUID. Dropping old integer product_id and renaming product_id_fix...",
        );

        // Drop old FK and integer column
        await client.query(`
          ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey
        `);
        await client.query(
          `ALTER TABLE cart_items DROP COLUMN IF EXISTS product_id`,
        );

        // Rename product_id_fix → product_id
        await client.query(`
          ALTER TABLE cart_items RENAME COLUMN product_id_fix TO product_id
        `);

        // Add FK for new product_id
        await client.query(`
          ALTER TABLE cart_items
          ADD CONSTRAINT cart_items_product_id_fkey
          FOREIGN KEY (product_id) REFERENCES products(id)
        `);
        console.log("✅ product_id is now uuid and linked to products.id");
      } else if (productsIdDataType === "integer") {
        // products uses integer — old product_id is correct, drop product_id_fix
        console.log(
          "🔧 products.id is integer. Dropping unused product_id_fix column...",
        );
        await client.query(`ALTER TABLE cart_items DROP COLUMN product_id_fix`);
        console.log(
          "✅ product_id_fix dropped — product_id (integer) is correct",
        );
      }
    } else {
      console.log("✅ No product_id_fix column — product_id is clean");
    }

    await client.query("COMMIT");
    console.log("\n✅ All schema fixes applied successfully!\n");

    // ── Verify final schema ────────────────────────────────────────────────
    console.log("=== FINAL cart_items SCHEMA ===");
    const finalSchema = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cart_items'
      ORDER BY ordinal_position
    `);
    console.table(finalSchema.rows);

    // ── Verify FK constraints ──────────────────────────────────────────────
    console.log("=== FOREIGN KEY CONSTRAINTS ON cart_items ===");
    const fks = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'cart_items'
    `);
    console.table(fks.rows);

    console.log(
      "\n🎉 Done! You can now restart your server and test the cart.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed:", err.message);
    console.error(err.stack);
    console.log("\nNo changes were made. Fix the error above and try again.");
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
