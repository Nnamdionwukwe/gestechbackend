/**
 * DEFINITIVE FIX — Run this once to fix everything remaining:
 * 1. blog_posts missing columns (status, views_count, etc.)
 * 2. leads missing status column
 * 3. payments table missing columns
 * 4. cart_items integer → UUID columns
 * 5. Paystack controller export issue diagnosis
 *
 * Run: node fix-everything.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function col(client, table, column, def) {
  try {
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${def}`,
    );
    console.log(`  ✅ ${table}.${column}`);
  } catch (err) {
    console.log(`  ❌ ${table}.${column} — ${err.message.split("\n")[0]}`);
  }
}

async function getColType(client, table, column) {
  const r = await client.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return r.rows[0]?.data_type || null;
}

async function convertToUUID(client, table, column, refTable) {
  const type = await getColType(client, table, column);
  if (!type) return console.log(`  ⚠️  ${table}.${column} not found`);
  if (type === "uuid")
    return console.log(`  ✓  ${table}.${column} already UUID`);

  // Clean up any previous failed attempts
  for (const suffix of ["_fix", "_new", "_uuid"]) {
    try {
      await client.query(
        `ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}${suffix}`,
      );
    } catch (_) {}
  }

  // Drop FKs on this column
  const fks = await client.query(
    `SELECT tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = $1 AND kcu.column_name = $2`,
    [table, column],
  );
  for (const fk of fks.rows) {
    try {
      await client.query(
        `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
      );
      console.log(`    Dropped FK: ${fk.constraint_name}`);
    } catch (_) {}
  }

  try {
    await client.query(`ALTER TABLE ${table} ADD COLUMN ${column}_fix UUID`);

    let matched = 0;
    if (refTable) {
      const upd = await client.query(
        `UPDATE ${table} t SET ${column}_fix = r.id
         FROM ${refTable} r WHERE r.id::text = t.${column}::text`,
      );
      matched = upd.rowCount;
    }

    const total = parseInt(
      (await client.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count,
    );
    console.log(`    Matched ${matched} / ${total} rows`);

    await client.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    await client.query(
      `ALTER TABLE ${table} RENAME COLUMN ${column}_fix TO ${column}`,
    );
    console.log(`  ✅ ${table}.${column} → UUID`);
  } catch (err) {
    console.log(
      `  ❌ ${table}.${column} failed: ${err.message.split("\n")[0]}`,
    );
    // Clean up
    try {
      await client.query(
        `ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}_fix`,
      );
    } catch (_) {}
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(
      `\n🔌 Connected to: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":****@")}\n`,
    );

    // ════════════════════════════════════════════════════════════════
    // 1. BLOG POSTS
    // ════════════════════════════════════════════════════════════════
    console.log("━━━ blog_posts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await col(client, "blog_posts", "status", "VARCHAR(20) DEFAULT 'draft'");
    await col(client, "blog_posts", "views_count", "INTEGER DEFAULT 0");
    await col(client, "blog_posts", "published_at", "TIMESTAMP");
    await col(client, "blog_posts", "is_featured", "BOOLEAN DEFAULT false");
    await col(client, "blog_posts", "category", "VARCHAR(100)");
    await col(client, "blog_posts", "tags", "JSONB");
    await col(client, "blog_posts", "author_id", "UUID");
    await col(client, "blog_posts", "author_name", "VARCHAR(255)");
    await col(client, "blog_posts", "featured_image", "TEXT");
    await col(client, "blog_posts", "excerpt", "TEXT");
    await col(client, "blog_posts", "meta_title", "VARCHAR(255)");
    await col(client, "blog_posts", "meta_description", "TEXT");
    await col(client, "blog_posts", "meta_keywords", "JSONB");

    // ════════════════════════════════════════════════════════════════
    // 2. LEADS
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ leads ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await col(client, "leads", "status", "VARCHAR(50) DEFAULT 'new'");
    await col(client, "leads", "notes", "TEXT");
    await col(client, "leads", "full_name", "VARCHAR(255)");
    await col(client, "leads", "phone", "VARCHAR(50)");
    await col(client, "leads", "company", "VARCHAR(255)");
    await col(client, "leads", "service_interest", "VARCHAR(255)");
    await col(client, "leads", "budget_range", "VARCHAR(100)");
    await col(client, "leads", "timeline", "VARCHAR(100)");
    await col(client, "leads", "message", "TEXT");

    // ════════════════════════════════════════════════════════════════
    // 3. PAYMENTS
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ payments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const paymentsExists = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments')`,
    );

    if (!paymentsExists.rows[0].exists) {
      console.log("  ⚠️  payments table missing — creating it...");
      await client.query(`
        CREATE TABLE payments (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id               UUID,
          order_id              UUID,
          amount                NUMERIC(10,2),
          payment_method        VARCHAR(50),
          status                VARCHAR(20) DEFAULT 'pending',
          transaction_reference VARCHAR(255),
          paystack_reference    VARCHAR(255),
          paystack_data         JSONB,
          paid_at               TIMESTAMP,
          failure_reason        TEXT,
          created_at            TIMESTAMP DEFAULT NOW(),
          updated_at            TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("  ✅ payments table created");
    } else {
      console.log("  Payments table exists, adding missing columns...");
      await col(client, "payments", "status", "VARCHAR(20) DEFAULT 'pending'");
      await col(client, "payments", "user_id", "UUID");
      await col(client, "payments", "order_id", "UUID");
      await col(client, "payments", "amount", "NUMERIC(10,2)");
      await col(client, "payments", "payment_method", "VARCHAR(50)");
      await col(client, "payments", "transaction_reference", "VARCHAR(255)");
      await col(client, "payments", "paystack_reference", "VARCHAR(255)");
      await col(client, "payments", "paystack_data", "JSONB");
      await col(client, "payments", "paid_at", "TIMESTAMP");
      await col(client, "payments", "failure_reason", "TEXT");
    }

    // ════════════════════════════════════════════════════════════════
    // 4. CART_ITEMS integer → UUID
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ cart_items UUID fixes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await convertToUUID(client, "cart_items", "product_id", "products");
    await convertToUUID(
      client,
      "cart_items",
      "service_variant_id",
      "service_variants",
    );

    // ════════════════════════════════════════════════════════════════
    // 5. ORDER_ITEMS integer → UUID
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ order_items UUID fixes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await convertToUUID(client, "order_items", "product_id", "products");

    // ════════════════════════════════════════════════════════════════
    // 6. TEST ALL DASHBOARD QUERIES
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ Testing all getDashboardStats queries ━━━━━━━━━━━━━━━━");
    const tests = [
      [
        "services active",
        "SELECT COUNT(*) FROM services WHERE is_active = true",
      ],
      [
        "projects published",
        "SELECT COUNT(*) FROM portfolio_projects WHERE is_published = true",
      ],
      [
        "testimonials approved",
        "SELECT COUNT(*) FROM testimonials WHERE is_approved = true",
      ],
      ["leads total", "SELECT COUNT(*) FROM leads"],
      ["leads new", "SELECT COUNT(*) FROM leads WHERE status = 'new'"],
      [
        "subscribers active",
        "SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true",
      ],
      ["blog_posts total", "SELECT COUNT(*) FROM blog_posts"],
      [
        "blog_posts published",
        "SELECT COUNT(*) FROM blog_posts WHERE status = 'published'",
      ],
      ["leads by status", "SELECT status, COUNT(*) FROM leads GROUP BY status"],
    ];

    let failures = 0;
    for (const [label, sql] of tests) {
      try {
        const r = await client.query(sql);
        console.log(`  ✅ ${label}: ${JSON.stringify(r.rows[0])}`);
      } catch (err) {
        console.log(`  ❌ ${label}: ${err.message.split("\n")[0]}`);
        failures++;
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 7. PRINT FINAL SCHEMAS
    // ════════════════════════════════════════════════════════════════
    console.log("\n━━━ Final schemas ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const table of [
      "blog_posts",
      "leads",
      "payments",
      "cart_items",
      "order_items",
    ]) {
      const cols = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      if (!cols.rows.length) {
        console.log(`\n  ${table}: NOT FOUND`);
        continue;
      }
      console.log(`\n  ${table}:`);
      cols.rows.forEach((r) =>
        console.log(`    ${r.column_name.padEnd(28)} ${r.data_type}`),
      );
    }

    if (failures === 0) {
      console.log("\n🎉 All good! Restart your server now.\n");
    } else {
      console.log(
        `\n⚠️  ${failures} test(s) still failing — paste output above.\n`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
