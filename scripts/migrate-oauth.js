// scripts/migrate-oauth.js
// Run: node scripts/migrate-oauth.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("\n🔧  OAuth Migration");
  console.log(
    "   DB:",
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"),
    "\n",
  );

  try {
    // ── Create oauth_accounts table ───────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider         TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        provider_email   TEXT,
        profile_data     JSONB,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(provider, provider_user_id)
      )
    `);
    console.log("  ✓ oauth_accounts table ready");

    // ── Add missing columns to users if needed ────────────────────────────────
    const columns = [
      { col: "signup_method", def: "TEXT DEFAULT 'email'" },
      { col: "is_verified", def: "BOOLEAN DEFAULT false" },
      { col: "profile_image", def: "TEXT" },
      { col: "phone_number", def: "TEXT" },
      { col: "last_login", def: "TIMESTAMPTZ" },
      { col: "reset_token", def: "TEXT" },
      { col: "reset_token_expires", def: "TIMESTAMPTZ" },
    ];

    for (const { col, def } of columns) {
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`,
      );
      console.log(`  ✓ users.${col}`);
    }

    // ── Verify ────────────────────────────────────────────────────────────────
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'oauth_accounts')
      ORDER BY table_name
    `);
    console.log("\n  Tables confirmed:");
    tables.rows.forEach((r) => console.log("    •", r.table_name));

    console.log("\n✅  Migration complete!\n");
  } catch (err) {
    console.error("\n❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
