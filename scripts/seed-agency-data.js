// scripts/create-portfolio-table.js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

async function createPortfolioTable() {
  console.log("🔧 Creating portfolio_projects table...\n");

  try {
    // Create portfolio_projects table
    console.log("📁 Creating portfolio_projects table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        client_name VARCHAR(255),
        category VARCHAR(100) NOT NULL,
        tags TEXT[] DEFAULT '{}',
        description TEXT NOT NULL,
        challenge TEXT,
        solution TEXT,
        results TEXT,
        thumbnail_url TEXT NOT NULL,
        images JSONB DEFAULT '[]',
        live_url VARCHAR(500),
        github_url VARCHAR(500),
        video_url VARCHAR(500),
        tech_stack TEXT[] DEFAULT '{}',
        duration VARCHAR(100),
        team_size INTEGER,
        is_featured BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT true,
        views_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        completed_at DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Portfolio projects table created\n");

    // Create indexes
    console.log("📊 Creating indexes...");
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portfolio_slug ON portfolio_projects(slug)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio_projects(category)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portfolio_featured ON portfolio_projects(is_featured)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_portfolio_published ON portfolio_projects(is_published)`,
    );
    console.log("✅ Indexes created\n");

    // Add trigger for updated_at
    console.log("🔔 Adding trigger...");
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await pool.query(
      `DROP TRIGGER IF EXISTS update_portfolio_updated_at ON portfolio_projects`,
    );
    await pool.query(`
      CREATE TRIGGER update_portfolio_updated_at 
        BEFORE UPDATE ON portfolio_projects 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log("✅ Trigger added\n");

    // Verify table exists
    console.log("🔍 Verifying table...");
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'portfolio_projects'
      )
    `);

    if (result.rows[0].exists) {
      console.log("✅ portfolio_projects table verified!\n");
      console.log("🎉 Success! Now you can run the seed script:");
      console.log("   node scripts/seed-agency-data.js\n");
    } else {
      console.log("❌ Table verification failed\n");
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
    console.error("Full error:", error);
    await pool.end();
    process.exit(1);
  }
}

createPortfolioTable();
