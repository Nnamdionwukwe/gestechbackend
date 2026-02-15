// scripts/migrations/create-agency-tables.js
const { Pool } = require("pg");
require("dotenv").config();
// Load .env.local for local development, fallback to .env
const path = require("path");
const envPath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "../.env")
    : path.resolve(__dirname, "../.env.local");

require("dotenv").config({ path: envPath });

require("dotenv").config({ path: ".env.local" }); // Use local env file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting migration: Create agency website tables...\n");

    await client.query("BEGIN");

    // ==================== SERVICES TABLE ====================
    console.log("📋 Creating services table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        tagline TEXT,
        description TEXT,
        long_description TEXT,
        icon VARCHAR(100),
        image VARCHAR(500),
        features JSONB,
        pricing_starts_at DECIMAL(10, 2),
        delivery_time VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        meta_title VARCHAR(255),
        meta_description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Services table created\n");

    // ==================== CLIENTS TABLE ====================
    console.log("📋 Creating clients table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        logo VARCHAR(500),
        website VARCHAR(500),
        industry VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Clients table created\n");

    // ==================== SERVICE PROJECTS TABLE ====================
    console.log("📋 Creating service_projects table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID REFERENCES services(id) ON DELETE CASCADE,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        challenge TEXT,
        solution TEXT,
        results TEXT,
        thumbnail VARCHAR(500),
        images JSONB,
        project_url VARCHAR(500),
        github_url VARCHAR(500),
        rating DECIMAL(2, 1),
        duration VARCHAR(100),
        team_size INTEGER,
        is_featured BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT true,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Service projects table created\n");

    // ==================== TECHNOLOGIES TABLE ====================
    console.log("📋 Creating technologies table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS technologies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(100),
        icon VARCHAR(500),
        color VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Technologies table created\n");

    // ==================== PROJECT TECHNOLOGIES TABLE ====================
    console.log("📋 Creating project_technologies table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_technologies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES service_projects(id) ON DELETE CASCADE,
        technology_id UUID REFERENCES technologies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, technology_id)
      );
    `);
    console.log("✅ Project technologies table created\n");

    // ==================== TESTIMONIALS TABLE ====================
    console.log("📋 Creating testimonials table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        author_name VARCHAR(255) NOT NULL,
        author_position VARCHAR(255),
        author_avatar VARCHAR(500),
        content TEXT NOT NULL,
        rating DECIMAL(2, 1) DEFAULT 5.0,
        is_featured BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Testimonials table created\n");

    // ==================== SERVICE TESTIMONIALS TABLE ====================
    console.log("📋 Creating service_testimonials table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_testimonials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID REFERENCES services(id) ON DELETE CASCADE,
        testimonial_id UUID REFERENCES testimonials(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(service_id, testimonial_id)
      );
    `);
    console.log("✅ Service testimonials table created\n");

    // ==================== TEAM MEMBERS TABLE ====================
    console.log("📋 Creating team_members table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        position VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        bio TEXT,
        avatar VARCHAR(500),
        linkedin VARCHAR(500),
        twitter VARCHAR(500),
        github VARCHAR(500),
        email VARCHAR(255),
        skills JSONB,
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Team members table created\n");

    // ==================== CONTACT INQUIRIES TABLE ====================
    console.log("📋 Creating contact_inquiries table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        company VARCHAR(255),
        service_interest VARCHAR(100),
        budget_range VARCHAR(100),
        message TEXT NOT NULL,
        timeline VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        assigned_to UUID REFERENCES team_members(id),
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Contact inquiries table created\n");

    // ==================== NEWSLETTER SUBSCRIBERS TABLE ====================
    console.log("📋 Creating newsletter_subscribers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        subscribed_at TIMESTAMP DEFAULT NOW(),
        unsubscribed_at TIMESTAMP
      );
    `);
    console.log("✅ Newsletter subscribers table created\n");

    // ==================== BLOG POSTS TABLE ====================
    console.log("📋 Creating blog_posts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        featured_image VARCHAR(500),
        category VARCHAR(100),
        author_id UUID REFERENCES team_members(id),
        reading_time INTEGER,
        view_count INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT false,
        is_featured BOOLEAN DEFAULT false,
        published_at TIMESTAMP,
        meta_title VARCHAR(255),
        meta_description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Blog posts table created\n");

    // ==================== TAGS TABLE ====================
    console.log("📋 Creating tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tags table created\n");

    // ==================== POST TAGS TABLE ====================
    console.log("📋 Creating post_tags table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
        tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(post_id, tag_id)
      );
    `);
    console.log("✅ Post tags table created\n");

    // ==================== CREATE INDEXES ====================
    console.log("📊 Creating indexes...");

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_services_category ON services(category)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug)",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_projects_service ON service_projects(service_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_projects_slug ON service_projects(slug)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_projects_featured ON service_projects(is_featured)",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured)",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_team_department ON team_members(department)",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_inquiries_status ON contact_inquiries(status)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_inquiries_created ON contact_inquiries(created_at DESC)",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(is_published, published_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug)",
    );

    console.log("✅ Indexes created\n");

    await client.query("COMMIT");
    console.log("✅ Migration completed successfully!\n");

    // Show created tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'services', 'clients', 'service_projects', 'technologies',
        'project_technologies', 'testimonials', 'service_testimonials',
        'team_members', 'contact_inquiries', 'newsletter_subscribers',
        'blog_posts', 'tags', 'post_tags'
      )
      ORDER BY table_name
    `);

    console.log("📋 Created tables:");
    tables.rows.forEach((row) => console.log(`  ✓ ${row.table_name}`));
    console.log();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  });
