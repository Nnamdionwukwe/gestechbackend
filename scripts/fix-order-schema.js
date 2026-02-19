// fix-order-schema.js
// Run with: node fix-order-schema.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixOrderSchema() {
  const client = await pool.connect();

  try {
    console.log("🔍 Checking order_items and orders schema...\n");

    // ── 1. Show order_items columns ───────────────────────────────────────
    console.log("=== order_items SCHEMA ===");
    const orderItemsCols = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position
    `);
    console.table(orderItemsCols.rows);

    // ── 2. Show orders columns ────────────────────────────────────────────
    console.log("=== orders SCHEMA ===");
    const ordersCols = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    console.table(ordersCols.rows);

    // ── 3. Check service_variants.id type ─────────────────────────────────
    const svIdType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'service_variants' AND column_name = 'id'
    `);
    const svType = svIdType.rows[0]?.data_type;
    console.log(`\nservice_variants.id type: ${svType}`);

    // ── 4. Check order_items.service_variant_id type ──────────────────────
    const oiSvCol = orderItemsCols.rows.find(
      (r) => r.column_name === "service_variant_id",
    );
    const oiSvType = oiSvCol?.data_type;
    console.log(`order_items.service_variant_id type: ${oiSvType}`);

    // ── 5. Check order_items.product_id type ──────────────────────────────
    const oiProdCol = orderItemsCols.rows.find(
      (r) => r.column_name === "product_id",
    );
    const oiProdType = oiProdCol?.data_type;
    const prodIdType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'id'
    `);
    const prodType = prodIdType.rows[0]?.data_type;
    console.log(`products.id type: ${prodType}`);
    console.log(`order_items.product_id type: ${oiProdType}\n`);

    // ── 6. Fix mismatches ─────────────────────────────────────────────────
    await client.query("BEGIN");

    let fixesApplied = 0;

    // Fix service_variant_id if mismatched
    if (oiSvType && svType && oiSvType !== svType) {
      console.log(
        `🔧 Fixing order_items.service_variant_id: ${oiSvType} → ${svType}`,
      );

      await client.query(`
        ALTER TABLE order_items 
        DROP CONSTRAINT IF EXISTS order_items_service_variant_id_fkey
      `);

      // Clear data if any to allow type cast
      const rowCount = await client.query(
        "SELECT COUNT(*) FROM order_items WHERE service_variant_id IS NOT NULL",
      );
      if (parseInt(rowCount.rows[0].count) > 0) {
        console.log(
          `  ⚠️  Clearing ${rowCount.rows[0].count} existing rows' service_variant_id to allow type change`,
        );
        await client.query(
          "UPDATE order_items SET service_variant_id = NULL WHERE service_variant_id IS NOT NULL",
        );
      }

      if (svType === "integer") {
        await client.query(`
          ALTER TABLE order_items 
          ALTER COLUMN service_variant_id TYPE integer 
          USING service_variant_id::text::integer
        `);
      } else if (svType === "uuid") {
        await client.query(`
          ALTER TABLE order_items 
          ALTER COLUMN service_variant_id TYPE uuid 
          USING service_variant_id::text::uuid
        `);
      }

      // Re-add FK
      await client.query(`
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_service_variant_id_fkey
        FOREIGN KEY (service_variant_id) REFERENCES service_variants(id)
      `);

      console.log(
        `✅ order_items.service_variant_id fixed to ${svType} with FK restored`,
      );
      fixesApplied++;
    } else {
      console.log(
        `✅ order_items.service_variant_id (${oiSvType}) matches service_variants.id (${svType})`,
      );
    }

    // Fix product_id if mismatched
    if (oiProdType && prodType && oiProdType !== prodType) {
      console.log(
        `🔧 Fixing order_items.product_id: ${oiProdType} → ${prodType}`,
      );

      await client.query(`
        ALTER TABLE order_items
        DROP CONSTRAINT IF EXISTS order_items_product_id_fkey
      `);

      const rowCount = await client.query(
        "SELECT COUNT(*) FROM order_items WHERE product_id IS NOT NULL",
      );
      if (parseInt(rowCount.rows[0].count) > 0) {
        console.log(
          `  ⚠️  Clearing ${rowCount.rows[0].count} existing rows' product_id to allow type change`,
        );
        await client.query(
          "UPDATE order_items SET product_id = NULL WHERE product_id IS NOT NULL",
        );
      }

      if (prodType === "integer") {
        await client.query(`
          ALTER TABLE order_items
          ALTER COLUMN product_id TYPE integer
          USING product_id::text::integer
        `);
      } else if (prodType === "uuid") {
        await client.query(`
          ALTER TABLE order_items
          ALTER COLUMN product_id TYPE uuid
          USING product_id::text::uuid
        `);
      }

      await client.query(`
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id)
      `);

      console.log(
        `✅ order_items.product_id fixed to ${prodType} with FK restored`,
      );
      fixesApplied++;
    } else {
      console.log(
        `✅ order_items.product_id (${oiProdType}) matches products.id (${prodType})`,
      );
    }

    await client.query("COMMIT");

    // ── 7. Verify orders table has all required columns ───────────────────
    console.log("\n=== CHECKING orders TABLE FOR REQUIRED COLUMNS ===");
    const requiredOrderCols = [
      "id",
      "user_id",
      "order_number",
      "order_status",
      "payment_status",
      "payment_method",
      "subtotal",
      "shipping_cost",
      "tax",
      "total",
      "shipping_address",
      "shipping_city",
      "shipping_state",
      "shipping_country",
      "shipping_postal_code",
      "shipping_phone",
      "billing_address",
      "billing_city",
      "billing_state",
      "billing_country",
      "billing_postal_code",
      "billing_phone",
      "notes",
    ];

    const foundOrderCols = ordersCols.rows.map((r) => r.column_name);
    const missingOrderCols = requiredOrderCols.filter(
      (c) => !foundOrderCols.includes(c),
    );

    if (missingOrderCols.length > 0) {
      console.error("❌ orders table is MISSING these columns:");
      missingOrderCols.forEach((c) => console.error(`   - ${c}`));
      console.log("\nAdd them with ALTER TABLE, e.g.:");
      missingOrderCols.forEach((c) => {
        const isNumeric = [
          "subtotal",
          "shipping_cost",
          "tax",
          "total",
        ].includes(c);
        const type = isNumeric ? "NUMERIC(15,2) DEFAULT 0" : "VARCHAR(255)";
        console.log(
          `  ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${c} ${type};`,
        );
      });
    } else {
      console.log("✅ All required columns present in orders table");
    }

    // ── 8. Final state ────────────────────────────────────────────────────
    console.log("\n=== FINAL order_items SCHEMA ===");
    const finalSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position
    `);
    console.table(finalSchema.rows);

    if (fixesApplied === 0) {
      console.log("\n✅ No type fixes needed — schema looks correct.");
      console.log(
        "   The error might be coming from the INSERT itself passing wrong types.",
      );
      console.log(
        "   Check that your orderController is not passing a UUID string",
      );
      console.log("   where an integer is expected, or vice versa.\n");
    } else {
      console.log(
        `\n🎉 Applied ${fixesApplied} fix(es). Restart your server and retry checkout.`,
      );
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

fixOrderSchema();
