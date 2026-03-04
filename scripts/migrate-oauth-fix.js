// scripts/migrate-oauth-fix.js
// Run: node scripts/migrate-oauth-fix.js
// Makes password_hash nullable so Google/OAuth users can register without a password.

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("\n🔧  OAuth Fix Migration");
  console.log(
    "   DB:",
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"),
    "\n",
  );

  try {
    // Allow password_hash to be NULL for Google/OAuth users
    await pool.query(`
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL
    `);
    console.log(
      "  ✓ users.password_hash  →  nullable (OAuth users have no password)",
    );

    // Verify the column is now nullable
    const res = await pool.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'users'
        AND column_name  = 'password_hash'
    `);
    const col = res.rows[0];
    console.log(
      `\n  Verified: password_hash  is_nullable=${col.is_nullable}  type=${col.data_type}`,
    );

    console.log("\n✅  Migration complete!\n");
  } catch (err) {
    console.error("\n❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
