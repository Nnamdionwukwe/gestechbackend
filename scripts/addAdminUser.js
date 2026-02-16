// seed-database.js
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function seedDatabase() {
  console.log("🌱 Starting database seeding...\n");

  try {
    // Check if data already exists
    const existingServices = await pool.query("SELECT COUNT(*) FROM services");
    const existingProjects = await pool.query(
      "SELECT COUNT(*) FROM portfolio_projects",
    );

    if (parseInt(existingServices.rows[0].count) > 6) {
      console.log("⚠️  Database already has data. Skipping seed...");
      return;
    }

    console.log("📦 Seeding additional data...\n");

    // Seed Projects
    console.log("Adding portfolio projects...");
    await pool.query(`
      INSERT INTO portfolio_projects (
        id, title, slug, category, service_name, client_name, description,
        challenge, solution, technologies, is_featured, is_published, year
      ) VALUES
        (
          uuid_generate_v4(),
          'E-Commerce Platform',
          'ecommerce-platform',
          'web-development',
          'Web Development',
          'ShopNow Inc',
          'A modern e-commerce platform with advanced features',
          'Client needed a scalable solution to handle high traffic during sales',
          'Built a microservices architecture with Redis caching and CDN integration',
          '["React", "Node.js", "PostgreSQL", "Redis", "AWS"]'::jsonb,
          true,
          true,
          2024
        ),
        (
          uuid_generate_v4(),
          'Fitness Tracking App',
          'fitness-tracking-app',
          'mobile-app-development',
          'Mobile App Development',
          'FitLife',
          'Cross-platform mobile app for fitness enthusiasts',
          'Create an engaging app that motivates users to stay active',
          'Developed gamification features and social sharing capabilities',
          '["React Native", "Firebase", "Node.js", "MongoDB"]'::jsonb,
          true,
          true,
          2024
        ),
        (
          uuid_generate_v4(),
          'Healthcare Dashboard',
          'healthcare-dashboard',
          'software-development',
          'Custom Software Development',
          'MediCare Systems',
          'Real-time healthcare analytics dashboard',
          'Hospital needed to visualize patient data and resource allocation',
          'Built a real-time dashboard with predictive analytics',
          '["Vue.js", "Python", "PostgreSQL", "Docker"]'::jsonb,
          false,
          true,
          2023
        ),
        (
          uuid_generate_v4(),
          'Brand Identity Redesign',
          'brand-identity-redesign',
          'ui-ux-design',
          'UI/UX Design',
          'TechStartup Co',
          'Complete brand identity and UI redesign',
          'Startup needed to rebrand for their Series A funding',
          'Created a modern design system and comprehensive brand guidelines',
          '["Figma", "Adobe XD", "Illustrator"]'::jsonb,
          false,
          true,
          2023
        )
      ON CONFLICT (slug) DO NOTHING;
    `);
    console.log("✅ Portfolio projects added\n");

    // Seed Team Members
    console.log("Adding team members...");
    await pool.query(`
      INSERT INTO team_members (
        id, full_name, position, department, bio, email, skills, is_active
      ) VALUES
        (
          uuid_generate_v4(),
          'Jane Doe',
          'CEO & Founder',
          'leadership',
          'Visionary leader with 15+ years in tech industry',
          'jane@gestech.com',
          '["Leadership", "Strategy", "Business Development"]'::jsonb,
          true
        ),
        (
          uuid_generate_v4(),
          'Alex Johnson',
          'Lead Developer',
          'development',
          'Full-stack developer specializing in modern web technologies',
          'alex@gestech.com',
          '["React", "Node.js", "PostgreSQL", "AWS"]'::jsonb,
          true
        ),
        (
          uuid_generate_v4(),
          'Emily Chen',
          'Senior UI/UX Designer',
          'design',
          'Creating beautiful and functional user experiences',
          'emily@gestech.com',
          '["Figma", "User Research", "Prototyping", "Design Systems"]'::jsonb,
          true
        ),
        (
          uuid_generate_v4(),
          'Michael Torres',
          'Marketing Manager',
          'marketing',
          'Digital marketing expert focused on growth and conversions',
          'michael@gestech.com',
          '["SEO", "Content Marketing", "Analytics", "Social Media"]'::jsonb,
          true
        )
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Team members added\n");

    // Seed Blog Posts
    console.log("Adding blog posts...");

    // Get admin user ID for author
    const adminUser = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@gestech.com' LIMIT 1",
    );
    const adminId = adminUser.rows[0]?.id;

    await pool.query(
      `
      INSERT INTO blog_posts (
        id, title, slug, excerpt, content, category, tags, author_id, author_name,
        status, is_featured, published_at
      ) VALUES
        (
          uuid_generate_v4(),
          'The Future of Web Development in 2024',
          'future-web-development-2024',
          'Exploring the latest trends and technologies shaping web development',
          'The web development landscape is constantly evolving. In this post, we explore the key trends including WebAssembly, Edge Computing, and AI-powered development tools that are shaping the future of web development.',
          'technology',
          '["web development", "trends", "technology"]'::jsonb,
          $1,
          'Admin User',
          'published',
          true,
          CURRENT_TIMESTAMP
        ),
        (
          uuid_generate_v4(),
          'Mobile App Development Best Practices',
          'mobile-app-best-practices',
          'Essential tips for building successful mobile applications',
          'Building a successful mobile app requires careful planning and execution. Learn about performance optimization, user experience design, and security best practices that will make your app stand out.',
          'mobile',
          '["mobile", "development", "best practices"]'::jsonb,
          $1,
          'Admin User',
          'published',
          false,
          CURRENT_TIMESTAMP - INTERVAL '7 days'
        ),
        (
          uuid_generate_v4(),
          'Why Your Business Needs a Digital Strategy',
          'digital-strategy-importance',
          'The importance of digital transformation for modern businesses',
          'In today''s digital age, having a comprehensive digital strategy is no longer optional. Discover how digital transformation can help your business grow and stay competitive.',
          'business',
          '["business", "digital strategy", "growth"]'::jsonb,
          $1,
          'Admin User',
          'published',
          false,
          CURRENT_TIMESTAMP - INTERVAL '14 days'
        )
      ON CONFLICT (slug) DO NOTHING;
    `,
      [adminId],
    );
    console.log("✅ Blog posts added\n");

    // Seed Leads (sample inquiries)
    console.log("Adding sample leads...");
    await pool.query(`
      INSERT INTO leads (
        id, full_name, email, phone, company, service_interest,
        budget_range, message, status
      ) VALUES
        (
          uuid_generate_v4(),
          'Robert Williams',
          'robert@example.com',
          '+1234567890',
          'Williams Corp',
          'web-development',
          '$10000-$25000',
          'We need a new corporate website with custom features',
          'new'
        ),
        (
          uuid_generate_v4(),
          'Lisa Anderson',
          'lisa@startup.io',
          '+0987654321',
          'StartupIO',
          'mobile-app-development',
          '$25000-$50000',
          'Looking to build an MVP for our mobile app idea',
          'contacted'
        )
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Sample leads added\n");

    // Seed Newsletter Subscribers
    console.log("Adding newsletter subscribers...");
    await pool.query(`
      INSERT INTO newsletter_subscribers (id, email, full_name, is_active) VALUES
        (uuid_generate_v4(), 'subscriber1@example.com', 'John Subscriber', true),
        (uuid_generate_v4(), 'subscriber2@example.com', 'Jane Reader', true),
        (uuid_generate_v4(), 'subscriber3@example.com', 'Bob Follower', true)
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log("✅ Newsletter subscribers added\n");

    console.log("✨ Database seeding completed successfully!\n");

    // Show summary
    const stats = await Promise.all([
      pool.query("SELECT COUNT(*) FROM services"),
      pool.query("SELECT COUNT(*) FROM portfolio_projects"),
      pool.query("SELECT COUNT(*) FROM testimonials"),
      pool.query("SELECT COUNT(*) FROM team_members"),
      pool.query("SELECT COUNT(*) FROM blog_posts"),
      pool.query("SELECT COUNT(*) FROM leads"),
      pool.query("SELECT COUNT(*) FROM newsletter_subscribers"),
    ]);

    console.log("📊 Database Summary:");
    console.log(`   Services: ${stats[0].rows[0].count}`);
    console.log(`   Projects: ${stats[1].rows[0].count}`);
    console.log(`   Testimonials: ${stats[2].rows[0].count}`);
    console.log(`   Team Members: ${stats[3].rows[0].count}`);
    console.log(`   Blog Posts: ${stats[4].rows[0].count}`);
    console.log(`   Leads: ${stats[5].rows[0].count}`);
    console.log(`   Subscribers: ${stats[6].rows[0].count}\n`);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error("\nError details:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding
seedDatabase();
