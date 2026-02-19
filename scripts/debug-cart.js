// debug-cart.js
// Run with: node debug-cart.js
// Place this file in your project root (same level as package.json)

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function debugCart() {
  const client = await pool.connect();
  console.log("✅ Connected to database\n");

  try {
    // ── 1. Check tables exist ──────────────────────────────────────────────
    console.log("=== CHECKING TABLES ===");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_name IN ('carts', 'cart_items', 'products', 'services', 'service_variants')
      ORDER BY table_name
    `);
    console.log(
      "Found tables:",
      tables.rows.map((r) => r.table_name),
    );

    const expectedTables = [
      "cart_items",
      "carts",
      "service_variants",
      "services",
    ];
    const foundTables = tables.rows.map((r) => r.table_name);
    const missingTables = expectedTables.filter(
      (t) => !foundTables.includes(t),
    );
    if (missingTables.length > 0) {
      console.error("❌ MISSING TABLES:", missingTables);
      console.log(
        "\nYou need to create these tables before the cart will work.",
      );
      return;
    }
    console.log("✅ All required tables exist\n");

    // ── 2. Check carts table columns ──────────────────────────────────────
    console.log("=== CARTS TABLE SCHEMA ===");
    const cartsSchema = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'carts'
      ORDER BY ordinal_position
    `);
    console.table(cartsSchema.rows);

    // Check for id default
    const cartsIdCol = cartsSchema.rows.find((r) => r.column_name === "id");
    if (!cartsIdCol) {
      console.error("❌ carts table has no 'id' column!");
    } else if (!cartsIdCol.column_default) {
      console.error(
        "❌ carts.id has NO DEFAULT — INSERTs will fail without providing an id!",
      );
      console.log(
        "   Fix: ALTER TABLE carts ALTER COLUMN id SET DEFAULT gen_random_uuid();\n",
      );
    } else {
      console.log("✅ carts.id default:", cartsIdCol.column_default, "\n");
    }

    // ── 3. Check cart_items table columns ─────────────────────────────────
    console.log("=== CART_ITEMS TABLE SCHEMA ===");
    const cartItemsSchema = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cart_items'
      ORDER BY ordinal_position
    `);
    console.table(cartItemsSchema.rows);

    const cartItemsIdCol = cartItemsSchema.rows.find(
      (r) => r.column_name === "id",
    );
    if (!cartItemsIdCol) {
      console.error("❌ cart_items table has no 'id' column!");
    } else if (!cartItemsIdCol.column_default) {
      console.error(
        "❌ cart_items.id has NO DEFAULT — INSERTs will fail without providing an id!",
      );
      console.log(
        "   Fix: ALTER TABLE cart_items ALTER COLUMN id SET DEFAULT gen_random_uuid();\n",
      );
    } else {
      console.log(
        "✅ cart_items.id default:",
        cartItemsIdCol.column_default,
        "\n",
      );
    }

    // ── 4. Try creating a test cart ───────────────────────────────────────
    console.log("=== TESTING CART INSERT ===");
    try {
      const testCart = await client.query(
        "INSERT INTO carts (user_id, subtotal, total) VALUES ($1, 0, 0) RETURNING *",
        ["00000000-0000-0000-0000-000000000000"], // fake UUID for test
      );
      console.log("✅ Cart INSERT works:", testCart.rows[0]);

      // Clean up test row
      await client.query("DELETE FROM carts WHERE id = $1", [
        testCart.rows[0].id,
      ]);
      console.log("✅ Test cart cleaned up\n");
    } catch (err) {
      console.error("❌ Cart INSERT failed:", err.message);
      console.log("   This is likely your root cause!\n");
    }

    // ── 5. Check service_variants data ────────────────────────────────────
    console.log("=== SERVICE VARIANTS SAMPLE ===");
    const variants = await client.query(
      "SELECT id, name, price, is_active FROM service_variants LIMIT 5",
    );
    if (variants.rows.length === 0) {
      console.log("⚠️  No service variants found in DB — add some test data");
    } else {
      console.table(variants.rows);
    }

    // ── 6. Check services join works ──────────────────────────────────────
    console.log("\n=== TESTING SERVICE VARIANTS JOIN ===");
    try {
      const joinTest = await client.query(`
        SELECT sv.id, sv.name, sv.price, s.name as service_name, s.is_active as service_active
        FROM service_variants sv
        JOIN services s ON sv.service_id = s.id
        WHERE sv.is_active = true
        LIMIT 3
      `);
      console.log("✅ JOIN works. Sample data:");
      console.table(joinTest.rows);
    } catch (err) {
      console.error("❌ JOIN failed:", err.message);
    }

    // ── 7. Check for UUID extension ───────────────────────────────────────
    console.log("\n=== CHECKING UUID EXTENSION ===");
    try {
      const uuidTest = await client.query("SELECT gen_random_uuid()");
      console.log(
        "✅ gen_random_uuid() works:",
        uuidTest.rows[0].gen_random_uuid,
      );
    } catch {
      try {
        const uuidTest2 = await client.query("SELECT uuid_generate_v4()");
        console.log(
          "✅ uuid_generate_v4() works:",
          uuidTest2.rows[0].uuid_generate_v4,
        );
      } catch {
        console.error("❌ No UUID function available!");
        console.log(
          '   Fix: Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` in your DB\n',
        );
      }
    }

    console.log("\n=== DEBUG COMPLETE ===");
    console.log(
      "If all checks passed but you still get 500s, share the output above.",
    );
  } catch (err) {
    console.error("❌ Unexpected error during debug:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

debugCart();
