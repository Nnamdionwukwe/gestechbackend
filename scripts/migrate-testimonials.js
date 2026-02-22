// migrate-testimonials.js
// Run with: node migrate-testimonials.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const migrations = [
  {
    description: "Add client_name column",
    check: `SELECT column_name FROM information_schema.columns 
            WHERE table_name='testimonials' AND column_name='client_name'`,
    sql: `ALTER TABLE testimonials ADD COLUMN client_name VARCHAR(255)`,
  },
  {
    description: "Add client_logo column",
    check: `SELECT column_name FROM information_schema.columns 
            WHERE table_name='testimonials' AND column_name='client_logo'`,
    sql: `ALTER TABLE testimonials ADD COLUMN client_logo TEXT`,
  },
  {
    description: "Add project_id column",
    check: `SELECT column_name FROM information_schema.columns 
            WHERE table_name='testimonials' AND column_name='project_id'`,
    sql: `ALTER TABLE testimonials ADD COLUMN project_id UUID`,
  },
  {
    description: "Add service_id column",
    check: `SELECT column_name FROM information_schema.columns 
            WHERE table_name='testimonials' AND column_name='service_id'`,
    sql: `ALTER TABLE testimonials ADD COLUMN service_id UUID`,
  },
  {
    description: "Add updated_at column",
    check: `SELECT column_name FROM information_schema.columns 
            WHERE table_name='testimonials' AND column_name='updated_at'`,
    sql: `ALTER TABLE testimonials ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  },
];

async function migrate() {
  const client = await pool.connect();
  console.log("✅ Connected to database\n");

  try {
    for (const migration of migrations) {
      const { rows } = await client.query(migration.check);

      if (rows.length > 0) {
        console.log(`⏭  Skipping — already exists: ${migration.description}`);
      } else {
        await client.query(migration.sql);
        console.log(`✅ Applied: ${migration.description}`);
      }
    }

    console.log("\n🎉 Migration complete!");

    // Show final column list
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'testimonials' 
      ORDER BY ordinal_position
    `);
    console.log("\nTestimonials table columns:");
    rows.forEach((r) => console.log(`  • ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
