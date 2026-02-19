/**
 * fix-subscribers.js
 *
 * Run from your project root:
 *   node fix-subscribers.js
 *
 * What it does:
 *   1. Connects to your DB using the same config as your app
 *   2. Inspects the real columns on newsletter_subscribers
 *   3. Adds missing columns (created_at, updated_at, is_active) if absent
 *   4. Prints a summary of what was found / changed
 */

const { Pool } = require("pg");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const TABLE = "newsletter_subscribers";

// Columns the controller expects — define type + default for each
const REQUIRED_COLUMNS = [
  {
    name: "created_at",
    type: "TIMESTAMP WITH TIME ZONE",
    default: "CURRENT_TIMESTAMP",
  },
  {
    name: "updated_at",
    type: "TIMESTAMP WITH TIME ZONE",
    default: "CURRENT_TIMESTAMP",
  },
  {
    name: "is_active",
    type: "BOOLEAN",
    default: "true",
  },
];

async function run() {
  console.log(`\n🔍 Inspecting table: ${TABLE}\n`);

  // 1. Fetch existing columns
  const { rows: existingCols } = await db.query(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [TABLE],
  );

  if (existingCols.length === 0) {
    console.error(
      `❌  Table "${TABLE}" not found. Check your DB connection or table name.`,
    );
    process.exit(1);
  }

  console.log("📋 Current columns:");
  existingCols.forEach((c) =>
    console.log(`   • ${c.column_name.padEnd(20)} ${c.data_type}`),
  );

  const existingNames = new Set(existingCols.map((c) => c.column_name));

  // 2. Add any missing columns
  const missing = REQUIRED_COLUMNS.filter((c) => !existingNames.has(c.name));

  if (missing.length === 0) {
    console.log("\n✅  All required columns already exist. No changes needed.");
    console.log(
      "\n💡 The error was likely a stale DB connection. Restart your server and retry.\n",
    );
  } else {
    console.log(
      `\n⚠️  Missing columns: ${missing.map((c) => c.name).join(", ")}`,
    );
    console.log("🔧 Adding them now...\n");

    for (const col of missing) {
      const sql = `ALTER TABLE ${TABLE} ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`;
      await db.query(sql);
      console.log(
        `   ✔ Added: ${col.name} (${col.type}, default: ${col.default})`,
      );

      // Back-fill existing rows with sensible defaults for timestamps
      if (col.name === "created_at" || col.name === "updated_at") {
        await db.query(
          `UPDATE ${TABLE} SET ${col.name} = CURRENT_TIMESTAMP WHERE ${col.name} IS NULL`,
        );
        console.log(`     ↳ Back-filled existing rows with CURRENT_TIMESTAMP`);
      }
    }

    console.log(
      "\n✅  Done! Re-run your server — the endpoint should work now.\n",
    );
  }

  // 3. Quick sanity test — try the exact query the controller uses
  console.log("🧪 Running sanity check query...");
  try {
    const { rows } = await db.query(
      `SELECT * FROM ${TABLE} ORDER BY created_at DESC LIMIT 3`,
    );
    console.log(
      `   ✔ Query succeeded. Found ${rows.length} row(s) in preview.\n`,
    );
  } catch (err) {
    console.error("   ❌ Query still failing:", err.message);
    console.error(
      "      Run the SQL above manually in psql and check for errors.\n",
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
