/**
 * Fix missing columns: blog_posts, leads, payments
 * Run: node fix-missing-columns.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.argv[2] || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addCol(client, table, column, definition) {
  try {
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
    );
    console.log(`  ✅ ${table}.${column}`);
  } catch (err) {
    console.log(`  ❌ ${table}.${column}: ${err.message.split("\n")[0]}`);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("🔧 Adding missing blog_posts columns...");
    await addCol(client, "blog_posts", "status", "VARCHAR(20) DEFAULT 'draft'");
    await addCol(client, "blog_posts", "views_count", "INTEGER DEFAULT 0");
    await addCol(client, "blog_posts", "published_at", "TIMESTAMP");
    await addCol(client, "blog_posts", "is_featured", "BOOLEAN DEFAULT false");
    await addCol(client, "blog_posts", "category", "VARCHAR(100)");
    await addCol(client, "blog_posts", "tags", "JSONB");
    await addCol(client, "blog_posts", "author_id", "UUID");
    await addCol(client, "blog_posts", "author_name", "VARCHAR(255)");
    await addCol(client, "blog_posts", "featured_image", "TEXT");
    await addCol(client, "blog_posts", "excerpt", "TEXT");
    await addCol(client, "blog_posts", "meta_title", "VARCHAR(255)");
    await addCol(client, "blog_posts", "meta_description", "TEXT");
    await addCol(client, "blog_posts", "meta_keywords", "JSONB");

    console.log("\n🔧 Adding missing leads columns...");
    await addCol(client, "leads", "status", "VARCHAR(50) DEFAULT 'new'");
    await addCol(client, "leads", "notes", "TEXT");
    await addCol(client, "leads", "full_name", "VARCHAR(255)");
    await addCol(client, "leads", "phone", "VARCHAR(50)");
    await addCol(client, "leads", "company", "VARCHAR(255)");
    await addCol(client, "leads", "service_interest", "VARCHAR(255)");
    await addCol(client, "leads", "budget_range", "VARCHAR(100)");
    await addCol(client, "leads", "timeline", "VARCHAR(100)");
    await addCol(client, "leads", "message", "TEXT");

    console.log("\n🔧 Checking payments table...");
    const paymentsCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'payments' ORDER BY ordinal_position
    `);

    if (paymentsCols.rows.length === 0) {
      console.log("  ⚠️  payments table not found");
    } else {
      console.log("  Current payments columns:");
      paymentsCols.rows.forEach((r) =>
        console.log(`    ${r.column_name.padEnd(28)} ${r.data_type}`),
      );

      await addCol(
        client,
        "payments",
        "status",
        "VARCHAR(20) DEFAULT 'pending'",
      );
      await addCol(client, "payments", "user_id", "UUID");
      await addCol(client, "payments", "order_id", "UUID");
      await addCol(client, "payments", "amount", "NUMERIC(10,2)");
      await addCol(client, "payments", "payment_method", "VARCHAR(50)");
      await addCol(client, "payments", "transaction_reference", "VARCHAR(255)");
      await addCol(client, "payments", "paystack_reference", "VARCHAR(255)");
      await addCol(client, "payments", "paystack_data", "JSONB");
      await addCol(client, "payments", "paid_at", "TIMESTAMP");
      await addCol(client, "payments", "failure_reason", "TEXT");
    }

    // ── Verify all dashboard queries work ─────────────────────────────────
    console.log("\n🧪 Testing all getDashboardStats queries...");
    const tests = [
      ["services", "SELECT COUNT(*) FROM services WHERE is_active = true"],
      [
        "portfolio_projects",
        "SELECT COUNT(*) FROM portfolio_projects WHERE is_published = true",
      ],
      [
        "testimonials",
        "SELECT COUNT(*) FROM testimonials WHERE is_approved = true",
      ],
      ["leads total", "SELECT COUNT(*) FROM leads"],
      ["leads new", "SELECT COUNT(*) FROM leads WHERE status = 'new'"],
      [
        "subscribers",
        "SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true",
      ],
      ["blog_posts total", "SELECT COUNT(*) FROM blog_posts"],
      [
        "blog_posts status",
        "SELECT COUNT(*) FROM blog_posts WHERE status = 'published'",
      ],
      ["leads by status", "SELECT status, COUNT(*) FROM leads GROUP BY status"],
    ];

    let allPassed = true;
    for (const [label, sql] of tests) {
      try {
        await client.query(sql);
        console.log(`  ✅ ${label}`);
      } catch (err) {
        console.log(`  ❌ ${label}: ${err.message.split("\n")[0]}`);
        allPassed = false;
      }
    }

    // ── Final schema printout ─────────────────────────────────────────────
    console.log("\n📋 Final blog_posts columns:");
    const bp = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'blog_posts' ORDER BY ordinal_position
    `);
    bp.rows.forEach((r) =>
      console.log(`  ${r.column_name.padEnd(28)} ${r.data_type}`),
    );

    console.log("\n📋 Final leads columns:");
    const leads = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'leads' ORDER BY ordinal_position
    `);
    leads.rows.forEach((r) =>
      console.log(`  ${r.column_name.padEnd(28)} ${r.data_type}`),
    );

    if (allPassed) {
      console.log("\n🎉 All queries pass! Restart your server.\n");
    } else {
      console.log(
        "\n⚠️  Some queries still failing — paste output above for help.\n",
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
