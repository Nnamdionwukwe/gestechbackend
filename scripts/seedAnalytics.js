// scripts/seedAnalytics.js
// Run with: node scripts/seedAnalytics.js
//
// Creates the page_views table in your PostgreSQL database
// and seeds it with some example rows so you can test queries immediately.

require("dotenv").config();
const { Pool } = require("pg");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── 1. Create table ───────────────────────────────────────────────────────────
async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_views (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path         TEXT NOT NULL,
      ip_hash      TEXT,          -- SHA-256 of visitor IP (privacy-safe)
      user_agent   TEXT,
      referrer     TEXT,
      country      TEXT,          -- optional: populate via IP-geo lookup
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Index for fast date-range and path queries
    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_page_views_path       ON page_views (path);
  `);
  console.log("✅  page_views table ready");
}

// ── 2. Seed example rows ──────────────────────────────────────────────────────
async function seedRows() {
  const paths = ["/", "/products", "/about", "/contact", "/blog", "/cart"];
  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/119",
  ];
  const referrers = [
    null,
    "https://google.com",
    "https://facebook.com",
    "https://twitter.com",
  ];

  // Generate 60 fake visits spread over the last 30 days
  const rows = Array.from({ length: 60 }, (_, i) => {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 24));

    // fake IP → hash
    const fakeIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const ipHash = crypto.createHash("sha256").update(fakeIp).digest("hex");

    return {
      id: uuidv4(),
      path: paths[Math.floor(Math.random() * paths.length)],
      ip_hash: ipHash,
      user_agent: agents[Math.floor(Math.random() * agents.length)],
      referrer: referrers[Math.floor(Math.random() * referrers.length)],
      created_at: date.toISOString(),
    };
  });

  for (const row of rows) {
    await pool.query(
      `INSERT INTO page_views (id, path, ip_hash, user_agent, referrer, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.path,
        row.ip_hash,
        row.user_agent,
        row.referrer,
        row.created_at,
      ],
    );
  }
  console.log(`✅  Seeded ${rows.length} example page view rows`);
}

// ── 3. Print a quick summary ──────────────────────────────────────────────────
async function printSummary() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                          AS total_visits,
      COUNT(DISTINCT ip_hash)           AS unique_visitors,
      MIN(created_at)::DATE             AS earliest,
      MAX(created_at)::DATE             AS latest
    FROM page_views
  `);
  console.log("\n📊  Analytics summary:");
  console.table(rows);

  const byPath = await pool.query(`
    SELECT path, COUNT(*) AS visits
    FROM page_views
    GROUP BY path
    ORDER BY visits DESC
  `);
  console.log("\n📄  Visits by page:");
  console.table(byPath.rows);
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await createTable();
    await seedRows();
    await printSummary();
  } catch (err) {
    console.error("❌  Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
