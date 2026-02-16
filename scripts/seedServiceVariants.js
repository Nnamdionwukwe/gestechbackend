// database/seed-service-variants.js
require("dotenv").config();
const db = require("../src/config/database");

async function seedServiceVariants() {
  console.log("🌱 Seeding Service Variants...\n");

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // Define variants for each service category
    const serviceVariants = {
      "software-development": [
        {
          name: "Custom Web Development",
          description:
            "Tailored web solutions built to your exact specifications",
          price: 5000.0,
          duration: "4-8 weeks",
          features: [
            "Custom architecture design",
            "RESTful API development",
            "Database design & optimization",
            "Admin dashboard",
            "Third-party integrations",
            "Performance optimization",
            "Security implementation",
            "Documentation & training",
          ],
        },
        {
          name: "Mobile Apps",
          description: "Native and cross-platform mobile applications",
          price: 8000.0,
          duration: "6-12 weeks",
          features: [
            "iOS & Android development",
            "Cross-platform framework",
            "Push notifications",
            "Offline functionality",
            "App store deployment",
            "Backend integration",
            "In-app purchases (optional)",
            "Analytics integration",
          ],
        },
        {
          name: "Cloud DevOps",
          description: "Cloud infrastructure and deployment automation",
          price: 3500.0,
          duration: "2-4 weeks",
          features: [
            "AWS/Azure/GCP setup",
            "CI/CD pipeline configuration",
            "Docker containerization",
            "Kubernetes orchestration",
            "Automated deployments",
            "Monitoring & logging",
            "Backup & disaster recovery",
            "Security hardening",
          ],
        },
      ],
      "mobile-app-development": [
        {
          name: "Cross-Platform",
          description:
            "Single codebase for iOS and Android using React Native or Flutter",
          price: 7000.0,
          duration: "6-10 weeks",
          features: [
            "React Native or Flutter",
            "iOS & Android deployment",
            "Native performance",
            "Shared codebase",
            "Platform-specific UI",
            "App store submission",
            "Push notifications",
            "Offline support",
          ],
        },
        {
          name: "iOS Development",
          description: "Native iOS applications using Swift and SwiftUI",
          price: 6000.0,
          duration: "5-8 weeks",
          features: [
            "Native Swift development",
            "SwiftUI interface",
            "Apple HIG compliance",
            "App Store optimization",
            "iPhone & iPad support",
            "Apple Watch integration (optional)",
            "iCloud sync",
            "TestFlight beta testing",
          ],
        },
        {
          name: "Android Development",
          description:
            "Native Android applications using Kotlin and Jetpack Compose",
          price: 6000.0,
          duration: "5-8 weeks",
          features: [
            "Native Kotlin development",
            "Jetpack Compose UI",
            "Material Design 3",
            "Play Store optimization",
            "Multi-device support",
            "Google services integration",
            "Firebase integration",
            "Beta testing program",
          ],
        },
      ],
      "web-development": [
        {
          name: "E-Commerce Websites",
          description: "Full-featured online store with payment integration",
          price: 4500.0,
          duration: "6-10 weeks",
          features: [
            "Product catalog management",
            "Shopping cart & checkout",
            "Payment gateway integration",
            "Order management system",
            "Customer accounts",
            "Inventory tracking",
            "Email notifications",
            "SEO optimization",
            "Mobile responsive design",
          ],
        },
        {
          name: "Corporate Websites",
          description: "Professional business website with CMS",
          price: 3000.0,
          duration: "4-6 weeks",
          features: [
            "Custom design",
            "Content management system",
            "About & services pages",
            "Contact forms",
            "Blog/News section",
            "Team member profiles",
            "Portfolio/Case studies",
            "SEO friendly",
            "Analytics integration",
          ],
        },
        {
          name: "Portfolio Sites",
          description: "Stunning portfolio to showcase your work",
          price: 2000.0,
          duration: "2-4 weeks",
          features: [
            "Modern, unique design",
            "Project galleries",
            "Case study pages",
            "About & contact",
            "Testimonials section",
            "Blog integration",
            "Mobile optimized",
            "Fast loading speed",
          ],
        },
        {
          name: "Web Applications",
          description: "Complex web-based applications and SaaS platforms",
          price: 10000.0,
          duration: "8-16 weeks",
          features: [
            "Custom functionality",
            "User authentication",
            "Role-based access",
            "Real-time features",
            "API development",
            "Database architecture",
            "Third-party integrations",
            "Admin dashboard",
            "Scalable infrastructure",
          ],
        },
      ],
      "ui-ux-design": [
        {
          name: "Web Design",
          description: "Modern, conversion-focused website designs",
          price: 2500.0,
          duration: "3-5 weeks",
          features: [
            "User research & analysis",
            "Wireframing",
            "High-fidelity mockups",
            "Interactive prototypes",
            "Responsive design",
            "Brand integration",
            "Design system creation",
            "Developer handoff files",
          ],
        },
        {
          name: "Mobile App Design",
          description: "Intuitive mobile app interfaces",
          price: 3000.0,
          duration: "4-6 weeks",
          features: [
            "User flow mapping",
            "Wireframes & prototypes",
            "iOS & Android designs",
            "Interaction design",
            "Micro-animations",
            "Icon design",
            "Design specifications",
            "Usability testing",
          ],
        },
        {
          name: "Design Systems",
          description: "Comprehensive design system for consistency",
          price: 4000.0,
          duration: "5-8 weeks",
          features: [
            "Component library",
            "Style guide",
            "Design tokens",
            "Typography system",
            "Color palette",
            "Icon library",
            "Pattern library",
            "Documentation",
            "Figma/Sketch files",
          ],
        },
        {
          name: "User Research",
          description: "In-depth user research and testing",
          price: 2000.0,
          duration: "2-4 weeks",
          features: [
            "User interviews",
            "Surveys & questionnaires",
            "Usability testing",
            "Analytics review",
            "Competitor analysis",
            "Persona development",
            "Journey mapping",
            "Insights report",
          ],
        },
      ],
    };

    // Get all services
    const servicesResult = await client.query(
      "SELECT id, category, name FROM services WHERE is_active = true ORDER BY category",
    );

    if (servicesResult.rows.length === 0) {
      console.log("⚠️  No services found. Please create services first.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    console.log(`Found ${servicesResult.rows.length} services\n`);

    let totalVariants = 0;

    // Insert variants for each service
    for (const service of servicesResult.rows) {
      const variants = serviceVariants[service.category];

      if (!variants || variants.length === 0) {
        console.log(`⏭️  ${service.name}: No variants (standalone service)`);
        continue;
      }

      console.log(`📋 ${service.name} (${service.category}):`);

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];

        await client.query(
          `INSERT INTO service_variants 
           (service_id, name, description, price, duration, features, is_active, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
          [
            service.id,
            variant.name,
            variant.description,
            variant.price,
            variant.duration,
            variant.features,
            i + 1,
          ],
        );

        console.log(`   ✅ ${variant.name} - $${variant.price}`);
        totalVariants++;
      }
    }

    await client.query("COMMIT");

    console.log(`\n🎉 Service Variants Seeded Successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Services processed: ${servicesResult.rows.length}`);
    console.log(`   - Total variants created: ${totalVariants}`);
    console.log(`\n💡 Services without variants (standalone):`);
    console.log(`   - Social Media Management`);
    console.log(`   - Digital Marketing`);

    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Seeding failed:", error);
    console.error("\nError details:", error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedServiceVariants();
