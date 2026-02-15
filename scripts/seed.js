// src/scripts/seed.js
require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

// Create pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

async function seedDatabase() {
  console.log("🌱 Starting database seeding...\n");

  try {
    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await pool.query("DELETE FROM newsletter_subscribers");
    await pool.query("DELETE FROM leads");
    await pool.query("DELETE FROM testimonials");
    await pool.query("DELETE FROM team_members");
    await pool.query("DELETE FROM portfolio_projects");
    await pool.query("DELETE FROM blog_posts");
    await pool.query("DELETE FROM services");
    console.log("✅ Data cleared\n");

    // ========================================
    // SEED SERVICES
    // ========================================
    console.log("📦 Seeding services...");
    const services = [
      {
        id: uuidv4(),
        name: "Software Development",
        slug: "software-development",
        description:
          "Custom software solutions built with cutting-edge technologies. We develop scalable, secure, and maintainable applications that drive business growth and digital transformation.",
        short_description: "Custom enterprise software solutions",
        icon: "💻",
        category: "software-development",
        pricing_type: "custom",
        starting_price: 10000,
        features: JSON.stringify([
          "Custom Application Development",
          "Enterprise Software Solutions",
          "API Development & Integration",
          "Cloud-Native Architecture",
          "Microservices Development",
          "DevOps & CI/CD",
        ]),
        is_featured: true,
        is_active: true,
        display_order: 1,
      },
      {
        id: uuidv4(),
        name: "Mobile App Development",
        slug: "mobile-app-development",
        description:
          "Native and cross-platform mobile applications for iOS and Android. We create beautiful, performant mobile experiences that users love.",
        short_description: "iOS & Android app development",
        icon: "📱",
        category: "mobile-app-development",
        pricing_type: "custom",
        starting_price: 15000,
        features: JSON.stringify([
          "iOS App Development",
          "Android App Development",
          "Cross-Platform Solutions",
          "App Store Optimization",
          "Push Notifications",
          "Mobile Analytics",
        ]),
        is_featured: true,
        is_active: true,
        display_order: 2,
      },
      {
        id: uuidv4(),
        name: "Web Development",
        slug: "web-development",
        description:
          "Modern, responsive websites and web applications. From landing pages to complex web platforms, we build digital experiences that convert.",
        short_description: "Modern web applications",
        icon: "🌐",
        category: "web-development",
        pricing_type: "custom",
        starting_price: 5000,
        features: JSON.stringify([
          "Responsive Web Design",
          "Progressive Web Apps",
          "E-commerce Solutions",
          "CMS Development",
          "SEO Optimization",
          "Performance Optimization",
        ]),
        is_featured: true,
        is_active: true,
        display_order: 3,
      },
      {
        id: uuidv4(),
        name: "UI/UX Design",
        slug: "ui-ux-design",
        description:
          "User-centered design that creates intuitive and engaging digital experiences. We combine aesthetics with functionality.",
        short_description: "Beautiful, intuitive interfaces",
        icon: "🎨",
        category: "ui-ux-design",
        pricing_type: "custom",
        starting_price: 3000,
        features: JSON.stringify([
          "User Research & Analysis",
          "Wireframing & Prototyping",
          "Visual Design",
          "Design Systems",
          "Usability Testing",
          "Interaction Design",
        ]),
        is_featured: true,
        is_active: true,
        display_order: 4,
      },
      {
        id: uuidv4(),
        name: "Social Media Management",
        slug: "social-media-management",
        description:
          "Strategic social media management and content creation. We help you build and engage your online community.",
        short_description: "Grow your social presence",
        icon: "📱",
        category: "social-media-management",
        pricing_type: "custom",
        starting_price: 2000,
        features: JSON.stringify([
          "Content Strategy",
          "Social Media Marketing",
          "Community Management",
          "Analytics & Reporting",
          "Influencer Outreach",
          "Paid Social Campaigns",
        ]),
        is_featured: true,
        is_active: true,
        display_order: 5,
      },
      {
        id: uuidv4(),
        name: "Digital Marketing",
        slug: "digital-marketing",
        description:
          "Comprehensive digital marketing strategies that drive results. From SEO to PPC, we help you reach your target audience.",
        short_description: "Drive traffic and conversions",
        icon: "📊",
        category: "digital-marketing",
        pricing_type: "custom",
        starting_price: 3000,
        features: JSON.stringify([
          "SEO & SEM",
          "Content Marketing",
          "Email Marketing",
          "PPC Campaigns",
          "Conversion Optimization",
          "Marketing Analytics",
        ]),
        is_featured: false,
        is_active: true,
        display_order: 6,
      },
    ];

    for (const service of services) {
      await pool.query(
        `
        INSERT INTO services (
          id, name, slug, description, short_description, icon, category,
          pricing_type, starting_price, features, is_featured, is_active, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
        [
          service.id,
          service.name,
          service.slug,
          service.description,
          service.short_description,
          service.icon,
          service.category,
          service.pricing_type,
          service.starting_price,
          service.features,
          service.is_featured,
          service.is_active,
          service.display_order,
        ],
      );
    }
    console.log(`✅ Seeded ${services.length} services\n`);

    // ========================================
    // SEED PORTFOLIO PROJECTS
    // ========================================
    console.log("📁 Seeding portfolio projects...");
    const projects = [
      {
        id: uuidv4(),
        title: "E-Commerce Platform",
        slug: "ecommerce-platform",
        client_name: "RetailCo",
        category: "Web Development",
        tags: JSON.stringify(["E-commerce", "React", "Node.js", "Stripe"]),
        description:
          "A full-featured e-commerce platform with inventory management, payment processing, and customer analytics.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1661956602116-aa6865609028?w=800",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1661956602116-aa6865609028?w=1200",
          "https://images.unsplash.com/photo-1661956602153-23384936a1d3?w=1200",
        ]),
        live_url: "https://example.com",
        tech_stack: JSON.stringify([
          "React",
          "Node.js",
          "PostgreSQL",
          "Stripe",
          "Redis",
        ]),
        is_featured: true,
        is_published: true,
        display_order: 1,
      },
      {
        id: uuidv4(),
        title: "Fitness Tracking App",
        slug: "fitness-tracking-app",
        client_name: "FitLife",
        category: "Mobile App",
        tags: JSON.stringify(["Mobile", "React Native", "Health"]),
        description:
          "A comprehensive fitness app with workout tracking, nutrition planning, and social features.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200",
        ]),
        tech_stack: JSON.stringify(["React Native", "Firebase", "Node.js"]),
        is_featured: true,
        is_published: true,
        display_order: 2,
      },
      {
        id: uuidv4(),
        title: "Corporate Website Redesign",
        slug: "corporate-website-redesign",
        client_name: "TechCorp",
        category: "UI/UX Design",
        tags: JSON.stringify(["Design", "Branding", "Web"]),
        description:
          "Complete website redesign with modern UI/UX, improved navigation, and enhanced user experience.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1200",
        ]),
        tech_stack: JSON.stringify(["Figma", "Adobe XD", "Webflow"]),
        is_featured: true,
        is_published: true,
        display_order: 3,
      },
      {
        id: uuidv4(),
        title: "Real Estate Platform",
        slug: "real-estate-platform",
        client_name: "PropFinder",
        category: "Web Development",
        tags: JSON.stringify(["Real Estate", "React", "Maps"]),
        description:
          "Property listing platform with advanced search, map integration, and virtual tours.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800",
        tech_stack: JSON.stringify([
          "React",
          "Node.js",
          "MongoDB",
          "Google Maps API",
        ]),
        is_featured: false,
        is_published: true,
        display_order: 4,
      },
      {
        id: uuidv4(),
        title: "Restaurant Management System",
        slug: "restaurant-management-system",
        client_name: "FoodHub",
        category: "Software Development",
        tags: JSON.stringify(["POS", "Management", "Cloud"]),
        description:
          "Cloud-based restaurant management system with POS, inventory, and analytics.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
        tech_stack: JSON.stringify(["Vue.js", "Laravel", "MySQL"]),
        is_featured: false,
        is_published: true,
        display_order: 5,
      },
      {
        id: uuidv4(),
        title: "Social Media Campaign",
        slug: "social-media-campaign",
        client_name: "BrandX",
        category: "Social Media",
        tags: JSON.stringify(["Marketing", "Social Media", "Campaign"]),
        description:
          "3-month social media campaign that increased engagement by 300% and grew followers by 50K.",
        thumbnail_url:
          "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800",
        tech_stack: JSON.stringify(["Instagram", "Facebook", "TikTok"]),
        is_featured: false,
        is_published: true,
        display_order: 6,
      },
    ];

    for (const project of projects) {
      await pool.query(
        `
        INSERT INTO portfolio_projects (
          id, title, slug, client_name, category, tags, description,
          thumbnail_url, images, live_url, tech_stack, is_featured, is_published, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
        [
          project.id,
          project.title,
          project.slug,
          project.client_name,
          project.category,
          project.tags,
          project.description,
          project.thumbnail_url,
          project.images,
          project.live_url,
          project.tech_stack,
          project.is_featured,
          project.is_published,
          project.display_order,
        ],
      );
    }
    console.log(`✅ Seeded ${projects.length} portfolio projects\n`);

    // ========================================
    // SEED TEAM MEMBERS
    // ========================================
    console.log("👥 Seeding team members...");
    const team = [
      {
        id: uuidv4(),
        full_name: "John Smith",
        slug: "john-smith",
        position: "CEO & Founder",
        department: "Leadership",
        bio: "Visionary leader with 15+ years in software development. Passionate about building innovative solutions.",
        skills: JSON.stringify([
          "Leadership",
          "Strategy",
          "Product Development",
        ]),
        linkedin_url: "https://linkedin.com",
        is_featured: true,
        is_active: true,
        display_order: 1,
      },
      {
        id: uuidv4(),
        full_name: "Sarah Johnson",
        slug: "sarah-johnson",
        position: "Lead Designer",
        department: "Design",
        bio: "Award-winning designer specializing in creating beautiful, user-centered experiences.",
        skills: JSON.stringify([
          "UI/UX Design",
          "Figma",
          "Design Systems",
          "Branding",
        ]),
        linkedin_url: "https://linkedin.com",
        is_featured: true,
        is_active: true,
        display_order: 2,
      },
      {
        id: uuidv4(),
        full_name: "Michael Chen",
        slug: "michael-chen",
        position: "Senior Full-Stack Developer",
        department: "Development",
        bio: "Full-stack expert with deep knowledge of React, Node.js, and cloud architecture.",
        skills: JSON.stringify([
          "React",
          "Node.js",
          "PostgreSQL",
          "AWS",
          "Docker",
        ]),
        github_url: "https://github.com",
        is_featured: true,
        is_active: true,
        display_order: 3,
      },
      {
        id: uuidv4(),
        full_name: "Emily Davis",
        slug: "emily-davis",
        position: "Marketing Director",
        department: "Marketing",
        bio: "Digital marketing strategist with proven track record in growth marketing.",
        skills: JSON.stringify([
          "SEO",
          "Content Marketing",
          "Social Media",
          "Analytics",
        ]),
        linkedin_url: "https://linkedin.com",
        is_featured: false,
        is_active: true,
        display_order: 4,
      },
    ];

    for (const member of team) {
      await pool.query(
        `
        INSERT INTO team_members (
          id, full_name, slug, position, department, bio, skills,
          linkedin_url, github_url, is_featured, is_active, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
        [
          member.id,
          member.full_name,
          member.slug,
          member.position,
          member.department,
          member.bio,
          member.skills,
          member.linkedin_url,
          member.github_url,
          member.is_featured,
          member.is_active,
          member.display_order,
        ],
      );
    }
    console.log(`✅ Seeded ${team.length} team members\n`);

    // ========================================
    // SEED TESTIMONIALS
    // ========================================
    console.log("💬 Seeding testimonials...");
    const testimonials = [
      {
        id: uuidv4(),
        client_name: "David Brown",
        client_position: "CEO",
        client_company: "TechStart Inc",
        rating: 5,
        content:
          "GesTech transformed our business with their innovative software solution. The team was professional, responsive, and delivered beyond our expectations. Highly recommended!",
        is_featured: true,
        is_approved: true,
        display_order: 1,
      },
      {
        id: uuidv4(),
        client_name: "Jennifer Martinez",
        client_position: "Marketing Director",
        client_company: "GrowthCo",
        rating: 5,
        content:
          "Working with GesTech on our social media strategy was a game-changer. Our engagement increased by 300% in just 3 months!",
        is_featured: true,
        is_approved: true,
        display_order: 2,
      },
      {
        id: uuidv4(),
        client_name: "Robert Wilson",
        client_position: "Founder",
        client_company: "AppVenture",
        rating: 5,
        content:
          "The mobile app they developed exceeded all our expectations. Beautiful design, smooth performance, and delivered on time!",
        is_featured: true,
        is_approved: true,
        display_order: 3,
      },
      {
        id: uuidv4(),
        client_name: "Lisa Anderson",
        client_position: "COO",
        client_company: "RetailHub",
        rating: 5,
        content:
          "GesTech built our e-commerce platform from scratch. Their expertise and attention to detail were outstanding.",
        is_featured: false,
        is_approved: true,
        display_order: 4,
      },
    ];

    for (const testimonial of testimonials) {
      await pool.query(
        `
        INSERT INTO testimonials (
          id, client_name, client_position, client_company, rating,
          content, is_featured, is_approved, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          testimonial.id,
          testimonial.client_name,
          testimonial.client_position,
          testimonial.client_company,
          testimonial.rating,
          testimonial.content,
          testimonial.is_featured,
          testimonial.is_approved,
          testimonial.display_order,
        ],
      );
    }
    console.log(`✅ Seeded ${testimonials.length} testimonials\n`);

    // ========================================
    // SEED BLOG POSTS
    // ========================================
    console.log("📝 Seeding blog posts...");
    const blogPosts = [
      {
        id: uuidv4(),
        title: "The Future of Web Development in 2024",
        slug: "future-of-web-development-2024",
        excerpt:
          "Exploring the latest trends and technologies shaping the future of web development.",
        content: "Full blog post content here...",
        category: "Technology",
        tags: JSON.stringify(["Web Development", "Trends", "Technology"]),
        status: "published",
        is_featured: true,
        reading_time: 5,
        published_at: new Date(),
      },
      {
        id: uuidv4(),
        title: "Mobile App Design Best Practices",
        slug: "mobile-app-design-best-practices",
        excerpt:
          "Essential design principles for creating engaging mobile applications.",
        content: "Full blog post content here...",
        category: "Design",
        tags: JSON.stringify(["Mobile", "Design", "UX"]),
        status: "published",
        is_featured: true,
        reading_time: 7,
        published_at: new Date(),
      },
      {
        id: uuidv4(),
        title: "Social Media Marketing Strategies That Work",
        slug: "social-media-marketing-strategies",
        excerpt:
          "Proven strategies to boost your social media presence and engagement.",
        content: "Full blog post content here...",
        category: "Marketing",
        tags: JSON.stringify(["Social Media", "Marketing", "Strategy"]),
        status: "published",
        is_featured: false,
        reading_time: 6,
        published_at: new Date(),
      },
    ];

    for (const post of blogPosts) {
      await pool.query(
        `
        INSERT INTO blog_posts (
          id, title, slug, excerpt, content, category, tags,
          status, is_featured, reading_time, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
        [
          post.id,
          post.title,
          post.slug,
          post.excerpt,
          post.content,
          post.category,
          post.tags,
          post.status,
          post.is_featured,
          post.reading_time,
          post.published_at,
        ],
      );
    }
    console.log(`✅ Seeded ${blogPosts.length} blog posts\n`);

    console.log("🎉 Database seeding completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`   • ${services.length} services`);
    console.log(`   • ${projects.length} portfolio projects`);
    console.log(`   • ${team.length} team members`);
    console.log(`   • ${testimonials.length} testimonials`);
    console.log(`   • ${blogPosts.length} blog posts\n`);

    console.log("🔗 Test your API:");
    console.log("   • http://localhost:5000/api/agency/services");
    console.log("   • http://localhost:5000/api/agency/portfolio");
    console.log("   • http://localhost:5000/api/agency/team");
    console.log("   • http://localhost:5000/api/agency/testimonials");
    console.log("   • http://localhost:5000/api/agency/blog\n");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    await pool.end();
    process.exit(1);
  }
}

seedDatabase();
