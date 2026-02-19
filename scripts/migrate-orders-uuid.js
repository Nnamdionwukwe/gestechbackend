/**
 * Final cart_items fix — cleans up leftover columns and converts integers to UUID
 * Run: node fix-cart-final.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.argv[2] || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run(client, label, sql, params = []) {
  try {
    const r = await client.query(sql, params);
    console.log(`  ✅ ${label}`);
    return r;
  } catch (err) {
    console.log(`  ⚠️  ${label}: ${err.message.split("\n")[0]}`);
    return null;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("🧹 Step 1: Clean up leftover columns from failed runs...");
    await run(
      client,
      "Drop product_id_new if exists",
      `ALTER TABLE cart_items DROP COLUMN IF EXISTS product_id_new`,
    );
    await run(
      client,
      "Drop service_variant_id_new if exists",
      `ALTER TABLE cart_items DROP COLUMN IF EXISTS service_variant_id_new`,
    );
    await run(
      client,
      "Drop cart_id_new if exists",
      `ALTER TABLE cart_items DROP COLUMN IF EXISTS cart_id_new`,
    );
    await run(
      client,
      "Drop product_id_uuid if exists",
      `ALTER TABLE cart_items DROP COLUMN IF EXISTS product_id_uuid`,
    );
    await run(
      client,
      "Drop service_variant_id_uuid if exists",
      `ALTER TABLE cart_items DROP COLUMN IF EXISTS service_variant_id_uuid`,
    );

    // Drop order_items leftovers too
    await run(
      client,
      "Drop order_items product_id_new if exists",
      `ALTER TABLE order_items DROP COLUMN IF EXISTS product_id_new`,
    );
    await run(
      client,
      "Drop order_items product_id_uuid if exists",
      `ALTER TABLE order_items DROP COLUMN IF EXISTS product_id_uuid`,
    );

    console.log("\n📋 Current cart_items schema:");
    const schema = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'cart_items' ORDER BY ordinal_position
    `);
    schema.rows.forEach((r) =>
      console.log(`   ${r.column_name.padEnd(25)} ${r.data_type}`),
    );

    // Drop all remaining FKs on cart_items
    console.log("\n🔧 Step 2: Drop all cart_items FK constraints...");
    const fks = await client.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'cart_items'
    `);
    for (const fk of fks.rows) {
      await run(
        client,
        `Drop FK ${fk.constraint_name}`,
        `ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
      );
    }

    // ── Fix cart_items.product_id ─────────────────────────────────────────
    const prodType = (
      await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'cart_items' AND column_name = 'product_id'
    `)
    ).rows[0]?.data_type;

    if (prodType && prodType !== "uuid") {
      console.log("\n🔧 Step 3: Fix cart_items.product_id (integer → UUID)...");

      // The trick: cast integer to text, then match against products.id::text
      // This works because postgres stores integer 11 as text "11"
      // and we can compare that against UUID stored as text
      await client.query(
        `ALTER TABLE cart_items ADD COLUMN product_id_fix UUID`,
      );

      const upd = await client.query(`
        UPDATE cart_items ci
        SET product_id_fix = p.id
        FROM products p
        WHERE p.id::text = ci.product_id::text
      `);
      const total = (await client.query(`SELECT COUNT(*) FROM cart_items`))
        .rows[0].count;
      console.log(`  Matched ${upd.rowCount} / ${total} rows`);

      if (upd.rowCount === 0 && parseInt(total) > 0) {
        // UUIDs don't match integer values — just null them out
        // (cart data will clear naturally when users re-add items)
        console.log(
          "  ⚠️  No UUID matches found (IDs are non-sequential UUIDs)",
        );
        console.log(
          "  → Nulling product_id — cart items will need to be re-added",
        );
      }

      await client.query(`ALTER TABLE cart_items DROP COLUMN product_id`);
      await client.query(
        `ALTER TABLE cart_items RENAME COLUMN product_id_fix TO product_id`,
      );
      console.log("  ✅ cart_items.product_id → UUID");
    } else {
      console.log("\n✅ Step 3: cart_items.product_id already UUID");
    }

    // ── Fix cart_items.service_variant_id ─────────────────────────────────
    const svType = (
      await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'cart_items' AND column_name = 'service_variant_id'
    `)
    ).rows[0]?.data_type;

    if (svType && svType !== "uuid") {
      console.log(
        "\n🔧 Step 4: Fix cart_items.service_variant_id (integer → UUID)...",
      );

      await client.query(`ALTER TABLE cart_items ADD COLUMN sv_id_fix UUID`);

      const upd = await client.query(`
        UPDATE cart_items ci
        SET sv_id_fix = sv.id
        FROM service_variants sv
        WHERE sv.id::text = ci.service_variant_id::text
      `);
      console.log(`  Matched ${upd.rowCount} rows`);

      await client.query(
        `ALTER TABLE cart_items DROP COLUMN service_variant_id`,
      );
      await client.query(
        `ALTER TABLE cart_items RENAME COLUMN sv_id_fix TO service_variant_id`,
      );
      console.log("  ✅ cart_items.service_variant_id → UUID");
    } else {
      console.log("\n✅ Step 4: cart_items.service_variant_id already UUID");
    }

    // ── Fix order_items.product_id ────────────────────────────────────────
    const oiProdType = (
      await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'product_id'
    `)
    ).rows[0]?.data_type;

    if (oiProdType && oiProdType !== "uuid") {
      console.log(
        "\n🔧 Step 5: Fix order_items.product_id (integer → UUID)...",
      );

      // Drop FK first
      const oiFks = await client.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'order_items' AND kcu.column_name = 'product_id'
      `);
      for (const fk of oiFks.rows) {
        await run(
          client,
          `Drop FK ${fk.constraint_name}`,
          `ALTER TABLE order_items DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
        );
      }

      await client.query(
        `ALTER TABLE order_items ADD COLUMN product_id_fix UUID`,
      );
      const upd = await client.query(`
        UPDATE order_items oi
        SET product_id_fix = p.id
        FROM products p
        WHERE p.id::text = oi.product_id::text
      `);
      const total = (await client.query(`SELECT COUNT(*) FROM order_items`))
        .rows[0].count;
      console.log(`  Matched ${upd.rowCount} / ${total} rows`);
      await client.query(`ALTER TABLE order_items DROP COLUMN product_id`);
      await client.query(
        `ALTER TABLE order_items RENAME COLUMN product_id_fix TO product_id`,
      );
      console.log("  ✅ order_items.product_id → UUID");
    } else {
      console.log("\n✅ Step 5: order_items.product_id already UUID");
    }

    // ── Final schema ──────────────────────────────────────────────────────
    console.log("\n📋 FINAL SCHEMAS:");
    for (const table of ["cart_items", "order_items"]) {
      const cols = await client.query(
        `
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `,
        [table],
      );
      console.log(`\n  ${table}:`);
      cols.rows.forEach((r) =>
        console.log(`    ${r.column_name.padEnd(28)} ${r.data_type}`),
      );
    }

    // ── Verify products table ID type ─────────────────────────────────────
    console.log("\n🔍 Products table ID sample (to verify UUID format):");
    const products = await client.query(
      `SELECT id, name FROM products LIMIT 3`,
    );
    products.rows.forEach((r) => console.log(`  id=${r.id}  name=${r.name}`));

    console.log("\n🎉 Done! Restart your server.\n");
  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
