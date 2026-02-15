// scripts/seed-agency-data.js
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function seedData() {
  const client = await pool.connect();

  try {
    console.log("🌱 Starting data seeding...\n");

    await client.query("BEGIN");

    // ==================== SEED SERVICES ====================
    console.log("📋 Seeding services...");

    const services = [
      {
        id: uuidv4(),
        name: "Custom Software Development",
        slug: "custom-software-development",
        category: "software-development",
        tagline: "Build scalable enterprise solutions",
        description:
          "Transform your business with custom software tailored to your needs",
        long_description:
          "Our expert team develops robust, scalable software solutions that drive business growth and operational efficiency.",
        icon: "code",
        features: JSON.stringify([
          "Scalable Architecture",
          "Cloud Integration",
          "API Development",
          "Database Design",
        ]),
        pricing_starts_at: 15000,
        delivery_time: "8-16 weeks",
        display_order: 1,
      },
      {
        id: uuidv4(),
        name: "Mobile App Development",
        slug: "mobile-app-development",
        category: "mobile-app-development",
        tagline: "iOS & Android apps that users love",
        description: "Native and cross-platform mobile apps with stunning UX",
        long_description:
          "We create beautiful, high-performance mobile applications for iOS and Android that engage users and drive results.",
        icon: "smartphone",
        features: JSON.stringify([
          "iOS & Android",
          "React Native",
          "Flutter",
          "App Store Optimization",
        ]),
        pricing_starts_at: 12000,
        delivery_time: "10-14 weeks",
        display_order: 2,
      },
      {
        id: uuidv4(),
        name: "Web Development",
        slug: "web-development",
        category: "web-development",
        tagline: "Modern websites that convert",
        description: "Responsive, fast, and SEO-optimized websites",
        long_description:
          "Build powerful web applications and websites with cutting-edge technologies and best practices.",
        icon: "globe",
        features: JSON.stringify([
          "React/Next.js",
          "Responsive Design",
          "SEO Optimized",
          "Progressive Web Apps",
        ]),
        pricing_starts_at: 8000,
        delivery_time: "6-10 weeks",
        display_order: 3,
      },
      {
        id: uuidv4(),
        name: "UI/UX Design",
        slug: "ui-ux-design",
        category: "ui-ux-design",
        tagline: "Designs that delight users",
        description: "Beautiful interfaces backed by user research",
        long_description:
          "Our designers create intuitive, visually stunning interfaces that provide exceptional user experiences.",
        icon: "palette",
        features: JSON.stringify([
          "User Research",
          "Wireframing",
          "Prototyping",
          "Design Systems",
        ]),
        pricing_starts_at: 5000,
        delivery_time: "4-6 weeks",
        display_order: 4,
      },
      {
        id: uuidv4(),
        name: "Social Media Management",
        slug: "social-media-management",
        category: "social-media-management",
        tagline: "Grow your social presence",
        description: "Strategic social media that drives engagement",
        long_description:
          "Build and engage your audience across all social platforms with data-driven strategies.",
        icon: "share-2",
        features: JSON.stringify([
          "Content Strategy",
          "Community Management",
          "Analytics",
          "Paid Campaigns",
        ]),
        pricing_starts_at: 2000,
        delivery_time: "Monthly retainer",
        display_order: 5,
      },
      {
        id: uuidv4(),
        name: "Digital Marketing",
        slug: "digital-marketing",
        category: "digital-marketing",
        tagline: "Marketing that delivers ROI",
        description: "Data-driven campaigns that convert",
        long_description:
          "Comprehensive digital marketing strategies including SEO, PPC, content marketing, and more.",
        icon: "trending-up",
        features: JSON.stringify([
          "SEO",
          "PPC",
          "Content Marketing",
          "Email Campaigns",
        ]),
        pricing_starts_at: 3000,
        delivery_time: "Monthly retainer",
        display_order: 6,
      },
    ];

    for (const service of services) {
      await client.query(
        `INSERT INTO services 
         (id, name, slug, category, tagline, description, long_description, icon, features, pricing_starts_at, delivery_time, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          service.id,
          service.name,
          service.slug,
          service.category,
          service.tagline,
          service.description,
          service.long_description,
          service.icon,
          service.features,
          service.pricing_starts_at,
          service.delivery_time,
          service.display_order,
        ],
      );
    }

    console.log(`✅ Seeded ${services.length} services\n`);

    // ==================== SEED TECHNOLOGIES ====================
    console.log("📋 Seeding technologies...");

    const technologies = [
      { name: "React", slug: "react", category: "frontend", color: "#61DAFB" },
      {
        name: "Next.js",
        slug: "nextjs",
        category: "frontend",
        color: "#000000",
      },
      { name: "Vue.js", slug: "vuejs", category: "frontend", color: "#4FC08D" },
      {
        name: "TypeScript",
        slug: "typescript",
        category: "language",
        color: "#3178C6",
      },
      {
        name: "Node.js",
        slug: "nodejs",
        category: "backend",
        color: "#339933",
      },
      {
        name: "Python",
        slug: "python",
        category: "language",
        color: "#3776AB",
      },
      { name: "Django", slug: "django", category: "backend", color: "#092E20" },
      {
        name: "PostgreSQL",
        slug: "postgresql",
        category: "database",
        color: "#4169E1",
      },
      {
        name: "MongoDB",
        slug: "mongodb",
        category: "database",
        color: "#47A248",
      },
      { name: "AWS", slug: "aws", category: "cloud", color: "#FF9900" },
      { name: "Docker", slug: "docker", category: "devops", color: "#2496ED" },
      {
        name: "React Native",
        slug: "react-native",
        category: "mobile",
        color: "#61DAFB",
      },
      {
        name: "Flutter",
        slug: "flutter",
        category: "mobile",
        color: "#02569B",
      },
      { name: "Figma", slug: "figma", category: "design", color: "#F24E1E" },
      {
        name: "Adobe XD",
        slug: "adobe-xd",
        category: "design",
        color: "#FF61F6",
      },
    ];

    for (const tech of technologies) {
      await client.query(
        `INSERT INTO technologies (name, slug, category, color)
         VALUES ($1, $2, $3, $4)`,
        [tech.name, tech.slug, tech.category, tech.color],
      );
    }

    console.log(`✅ Seeded ${technologies.length} technologies\n`);

    // ==================== SEED CLIENTS ====================
    console.log("📋 Seeding clients...");

    const clientsData = [
      { name: "TechCorp", industry: "Technology" },
      { name: "FinanceHub", industry: "Finance" },
      { name: "HealthPlus", industry: "Healthcare" },
      { name: "EduLearn", industry: "Education" },
      { name: "RetailMax", industry: "E-commerce" },
    ];

    const clientIds = [];
    for (const clientData of clientsData) {
      const result = await client.query(
        `INSERT INTO clients (name, industry) VALUES ($1, $2) RETURNING id`,
        [clientData.name, clientData.industry],
      );
      clientIds.push(result.rows[0].id);
    }

    console.log(`✅ Seeded ${clientsData.length} clients\n`);

    // ==================== SEED TEAM MEMBERS ====================
    console.log("📋 Seeding team members...");

    const teamMembers = [
      {
        name: "Sarah Johnson",
        position: "CEO & Co-Founder",
        department: "leadership",
        bio: "Visionary leader with 15+ years in tech",
        display_order: 1,
      },
      {
        name: "Michael Chen",
        position: "CTO",
        department: "leadership",
        bio: "Tech innovator and architect",
        display_order: 2,
      },
      {
        name: "Emily Rodriguez",
        position: "Lead Designer",
        department: "design",
        bio: "Award-winning UX/UI designer",
        display_order: 3,
      },
      {
        name: "David Kim",
        position: "Senior Full Stack Developer",
        department: "development",
        bio: "Expert in React and Node.js",
        display_order: 4,
      },
      {
        name: "Lisa Brown",
        position: "Marketing Director",
        department: "marketing",
        bio: "Digital marketing strategist",
        display_order: 5,
      },
    ];

    const teamIds = [];
    for (const member of teamMembers) {
      const result = await client.query(
        `INSERT INTO team_members (name, position, department, bio, display_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          member.name,
          member.position,
          member.department,
          member.bio,
          member.display_order,
        ],
      );
      teamIds.push(result.rows[0].id);
    }

    console.log(`✅ Seeded ${teamMembers.length} team members\n`);

    // ==================== SEED TESTIMONIALS ====================
    console.log("📋 Seeding testimonials...");

    const testimonials = [
      {
        client_id: clientIds[0],
        author_name: "John Smith",
        author_position: "CEO at TechCorp",
        content:
          "Outstanding work! They delivered a scalable solution that exceeded our expectations. The team was professional, responsive, and truly understood our needs.",
        rating: 5.0,
        is_featured: true,
      },
      {
        client_id: clientIds[1],
        author_name: "Jane Doe",
        author_position: "CTO at FinanceHub",
        content:
          "Excellent development team! They built our fintech platform on time and within budget. Highly recommended!",
        rating: 5.0,
        is_featured: true,
      },
      {
        client_id: clientIds[2],
        author_name: "Robert Wilson",
        author_position: "Product Manager at HealthPlus",
        content:
          "Great UI/UX design! Our users love the new interface. The designers really listened to our feedback.",
        rating: 4.5,
        is_featured: false,
      },
    ];

    for (const testimonial of testimonials) {
      await client.query(
        `INSERT INTO testimonials (client_id, author_name, author_position, content, rating, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          testimonial.client_id,
          testimonial.author_name,
          testimonial.author_position,
          testimonial.content,
          testimonial.rating,
          testimonial.is_featured,
        ],
      );
    }

    console.log(`✅ Seeded ${testimonials.length} testimonials\n`);

    await client.query("COMMIT");
    console.log("✅ Data seeding completed successfully!\n");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Seeding failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedData()
  .then(() => {
    console.log("✅ Seeding script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding script failed:", error);
    process.exit(1);
  });
