/**
 * Migration: Convert orders, order_items, and payments
 * id/order_id columns from INTEGER to UUID
 *
 * Run with: node migrate-orders-uuid.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
async function migrate() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting UUID migration...\n");

    // ── 1. Enable pgcrypto for gen_random_uuid() if not already enabled ──
    console.log("📦 Enabling pgcrypto extension...");
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    console.log("✅ pgcrypto ready\n");

    await client.query("BEGIN");

    // ── 2. Inspect current column types ──
    console.log("🔍 Checking current column types...");
    const typeCheck = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('orders', 'order_items', 'payments')
        AND column_name IN ('id', 'order_id', 'user_id')
      ORDER BY table_name, column_name
    `);

    console.log("Current schema:");
    typeCheck.rows.forEach((r) =>
      console.log(`  ${r.table_name}.${r.column_name} → ${r.data_type}`),
    );
    console.log();

    const needsFix = typeCheck.rows.some(
      (r) =>
        r.data_type === "integer" &&
        ((r.table_name === "orders" && r.column_name === "id") ||
          (r.table_name === "order_items" && r.column_name === "order_id") ||
          (r.table_name === "payments" && r.column_name === "order_id")),
    );

    if (!needsFix) {
      console.log("✅ Columns already UUID — no migration needed.");
      await client.query("ROLLBACK");
      return;
    }

    // ── 3. Drop foreign key constraints ──
    console.log("🔗 Dropping foreign key constraints...");

    // Fetch actual FK constraint names dynamically
    const fkResult = await client.query(`
      SELECT tc.constraint_name, tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('order_items', 'payments')
        AND kcu.column_name = 'order_id'
    `);

    for (const fk of fkResult.rows) {
      await client.query(
        `ALTER TABLE ${fk.table_name} DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
      );
      console.log(`  ✅ Dropped ${fk.table_name}.${fk.constraint_name}`);
    }
    console.log();

    // ── 4. Drop primary key on orders ──
    console.log("🔑 Dropping orders primary key...");
    const pkResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'orders' AND constraint_type = 'PRIMARY KEY'
    `);
    if (pkResult.rows.length > 0) {
      const pkName = pkResult.rows[0].constraint_name;
      await client.query(`ALTER TABLE orders DROP CONSTRAINT "${pkName}"`);
      console.log(`  ✅ Dropped orders primary key: ${pkName}\n`);
    }

    // ── 5. Migrate orders.id ──
    console.log("🔄 Migrating orders.id to UUID...");

    // Add a temp UUID column, populate it, then swap
    await client.query(
      `ALTER TABLE orders ADD COLUMN new_id UUID DEFAULT gen_random_uuid()`,
    );
    await client.query(`UPDATE orders SET new_id = gen_random_uuid()`);

    // Also store a mapping old_int_id → new_uuid for child tables
    await client.query(`
      CREATE TEMP TABLE id_mapping AS
      SELECT id AS old_id, new_id FROM orders
    `);

    await client.query(`ALTER TABLE orders DROP COLUMN id`);
    await client.query(`ALTER TABLE orders RENAME COLUMN new_id TO id`);
    await client.query(`ALTER TABLE orders ADD PRIMARY KEY (id)`);
    await client.query(
      `ALTER TABLE orders ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
    );
    console.log("  ✅ orders.id migrated\n");

    // ── 6. Migrate order_items.order_id ──
    console.log("🔄 Migrating order_items.order_id to UUID...");
    await client.query(`ALTER TABLE order_items ADD COLUMN new_order_id UUID`);
    await client.query(`
      UPDATE order_items oi
      SET new_order_id = m.new_id
      FROM id_mapping m
      WHERE oi.order_id = m.old_id
    `);
    await client.query(`ALTER TABLE order_items DROP COLUMN order_id`);
    await client.query(
      `ALTER TABLE order_items RENAME COLUMN new_order_id TO order_id`,
    );
    console.log("  ✅ order_items.order_id migrated\n");

    // ── 7. Migrate payments.order_id ──
    console.log("🔄 Migrating payments.order_id to UUID...");
    const paymentsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'payments'
      )
    `);
    if (paymentsExists.rows[0].exists) {
      await client.query(`ALTER TABLE payments ADD COLUMN new_order_id UUID`);
      await client.query(`
        UPDATE payments p
        SET new_order_id = m.new_id
        FROM id_mapping m
        WHERE p.order_id = m.old_id
      `);
      await client.query(`ALTER TABLE payments DROP COLUMN order_id`);
      await client.query(
        `ALTER TABLE payments RENAME COLUMN new_order_id TO order_id`,
      );
      console.log("  ✅ payments.order_id migrated\n");
    } else {
      console.log("  ⚠️  payments table not found — skipping\n");
    }

    // ── 8. Re-add foreign key constraints ──
    console.log("🔗 Re-adding foreign key constraints...");
    await client.query(`
      ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    `);
    console.log("  ✅ order_items FK restored");

    if (paymentsExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE payments
        ADD CONSTRAINT payments_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      `);
      console.log("  ✅ payments FK restored");
    }
    console.log();

    // ── 9. Verify ──
    console.log("🔍 Verifying final schema...");
    const verify = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('orders', 'order_items', 'payments')
        AND column_name IN ('id', 'order_id')
      ORDER BY table_name, column_name
    `);
    verify.rows.forEach((r) =>
      console.log(`  ${r.table_name}.${r.column_name} → ${r.data_type}`),
    );
    console.log();

    await client.query("COMMIT");
    console.log("🎉 Migration complete! All columns are now UUID.\n");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed — rolled back:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
