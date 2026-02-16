// src/controllers/servicesController.js
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// Get all services (WITH VARIANTS)
exports.getAllServices = async (req, res) => {
  try {
    const { category } = req.query;

    let query = `
      SELECT * FROM services
      WHERE is_active = true
    `;

    const params = [];

    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY display_order ASC, created_at DESC`;

    const services = await db.query(query, params);

    // Get variants for each service
    const servicesWithVariants = await Promise.all(
      services.rows.map(async (service) => {
        const variants = await db.query(
          `SELECT id, name, description, price, duration, features, display_order
           FROM service_variants
           WHERE service_id = $1 AND is_active = true
           ORDER BY display_order ASC`,
          [service.id],
        );

        return {
          ...service,
          variants: variants.rows,
          has_variants: variants.rows.length > 0,
        };
      }),
    );

    res.json({
      success: true,
      services: servicesWithVariants,
      categories: [
        "software-development",
        "mobile-app-development",
        "web-development",
        "ui-ux-design",
        "social-media-management",
        "digital-marketing",
      ],
    });
  } catch (error) {
    console.error("Get all services error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch services",
      details: error.message,
    });
  }
};

// Get service by slug (WITH VARIANTS)
exports.getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const service = await db.query(
      `SELECT * FROM services WHERE slug = $1 AND is_active = true`,
      [slug],
    );

    if (service.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Service not found",
      });
    }

    // Get variants for this service
    const variants = await db.query(
      `SELECT id, name, description, price, duration, features, display_order
       FROM service_variants
       WHERE service_id = $1 AND is_active = true
       ORDER BY display_order ASC`,
      [service.rows[0].id],
    );

    // Get related projects
    const projects = await db.query(
      `SELECT * FROM portfolio_projects 
       WHERE category ILIKE '%' || $1 || '%'
       AND is_published = true 
       ORDER BY is_featured DESC, created_at DESC 
       LIMIT 6`,
      [service.rows[0].name],
    );

    // Get testimonials
    const testimonials = await db.query(
      `SELECT * FROM testimonials
       WHERE is_approved = true
       ORDER BY is_featured DESC, created_at DESC
       LIMIT 4`,
    );

    res.json({
      success: true,
      service: {
        ...service.rows[0],
        variants: variants.rows,
        has_variants: variants.rows.length > 0,
      },
      projects: projects.rows,
      testimonials: testimonials.rows,
    });
  } catch (error) {
    console.error("Get service by slug error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service",
    });
  }
};

// Get single service variant
exports.getServiceVariant = async (req, res) => {
  try {
    const { variantId } = req.params;

    const variant = await db.query(
      `SELECT sv.*, s.name as service_name, s.category, s.slug as service_slug
       FROM service_variants sv
       JOIN services s ON sv.service_id = s.id
       WHERE sv.id = $1 AND sv.is_active = true AND s.is_active = true`,
      [variantId],
    );

    if (variant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Service variant not found",
      });
    }

    res.json({
      success: true,
      variant: variant.rows[0],
    });
  } catch (error) {
    console.error("Get service variant error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch service variant",
    });
  }
};

// Get portfolio/projects
exports.getPortfolio = async (req, res) => {
  try {
    const { category, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT *
      FROM portfolio_projects
      WHERE is_published = true
    `;

    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category ILIKE '%' || $${params.length} || '%'`;
    }

    query += ` ORDER BY is_featured DESC, created_at DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(parseInt(limit), parseInt(offset));

    const projects = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM portfolio_projects
      WHERE is_published = true
    `;

    const countParams = [];

    if (category) {
      countParams.push(category);
      countQuery += ` AND category ILIKE '%' || $1 || '%'`;
    }

    const total = await db.query(countQuery, countParams);

    res.json({
      success: true,
      projects: projects.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get portfolio error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch portfolio",
    });
  }
};

// Get project by slug
exports.getProjectBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const project = await db.query(
      `SELECT * FROM portfolio_projects
       WHERE slug = $1 AND is_published = true`,
      [slug],
    );

    if (project.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    // Get related projects (same category)
    const related = await db.query(
      `SELECT * FROM portfolio_projects
       WHERE category = $1 
       AND id != $2
       AND is_published = true
       ORDER BY created_at DESC
       LIMIT 3`,
      [project.rows[0].category, project.rows[0].id],
    );

    res.json({
      success: true,
      project: project.rows[0],
      relatedProjects: related.rows,
    });
  } catch (error) {
    console.error("Get project by slug error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch project",
    });
  }
};

// Get testimonials
exports.getTestimonials = async (req, res) => {
  try {
    const { featured } = req.query;

    let query = `
      SELECT *
      FROM testimonials
      WHERE is_approved = true
    `;

    if (featured === "true") {
      query += ` AND is_featured = true`;
    }

    query += ` ORDER BY display_order ASC, created_at DESC`;

    const testimonials = await db.query(query);

    res.json({
      success: true,
      testimonials: testimonials.rows,
    });
  } catch (error) {
    console.error("Get testimonials error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch testimonials",
    });
  }
};

// Get team members
exports.getTeamMembers = async (req, res) => {
  try {
    const { department } = req.query;

    let query = `
      SELECT * FROM team_members
      WHERE is_active = true
    `;

    const params = [];

    if (department) {
      query += ` AND department = $1`;
      params.push(department);
    }

    query += ` ORDER BY display_order ASC, created_at DESC`;

    const team = await db.query(query, params);

    res.json({
      success: true,
      team: team.rows,
      departments: [
        "leadership",
        "development",
        "design",
        "marketing",
        "sales",
        "operations",
      ],
    });
  } catch (error) {
    console.error("Get team members error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch team members",
    });
  }
};

// Submit contact form
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, company, service, budget, message, timeline } =
      req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and message are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    const inquiry = await db.query(
      `INSERT INTO leads
       (id, full_name, email, phone, company, service_interest, 
        budget_range, message, timeline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
       RETURNING *`,
      [
        uuidv4(),
        name,
        email,
        phone || null,
        company || null,
        service || null,
        budget || null,
        message,
        timeline || null,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Thank you! We'll get back to you within 24 hours.",
      inquiry: inquiry.rows[0],
    });
  } catch (error) {
    console.error("Submit contact form error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit inquiry",
    });
  }
};

// Subscribe to newsletter
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Check if already subscribed
    const existing = await db.query(
      "SELECT id FROM newsletter_subscribers WHERE email = $1",
      [email],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "This email is already subscribed",
      });
    }

    await db.query(
      `INSERT INTO newsletter_subscribers (id, email, full_name, is_active)
       VALUES ($1, $2, $3, true)`,
      [uuidv4(), email, name || null],
    );

    res.json({
      success: true,
      message: "Successfully subscribed to our newsletter!",
    });
  } catch (error) {
    console.error("Subscribe newsletter error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to subscribe",
    });
  }
};

// Get technologies
exports.getTechnologies = async (req, res) => {
  try {
    // Return static tech stack for now
    const technologies = {
      frontend: ["React", "Vue.js", "Angular", "Next.js"],
      backend: ["Node.js", "Python", "PHP", "Ruby"],
      mobile: ["React Native", "Flutter", "Swift", "Kotlin"],
      database: ["PostgreSQL", "MongoDB", "MySQL", "Redis"],
      cloud: ["AWS", "Google Cloud", "Azure", "DigitalOcean"],
    };

    res.json({
      success: true,
      technologies: technologies,
    });
  } catch (error) {
    console.error("Get technologies error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch technologies",
    });
  }
};

// Get blog posts
exports.getBlogPosts = async (req, res) => {
  try {
    const { category, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT *
      FROM blog_posts
      WHERE status = 'published'
    `;

    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY is_featured DESC, published_at DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(parseInt(limit), parseInt(offset));

    const posts = await db.query(query, params);

    // Get total
    let countQuery = `SELECT COUNT(*) as total FROM blog_posts WHERE status = 'published'`;
    const countParams = [];

    if (category) {
      countParams.push(category);
      countQuery += ` AND category = $1`;
    }

    const total = await db.query(countQuery, countParams);

    res.json({
      success: true,
      posts: posts.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get blog posts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog posts",
    });
  }
};

// Get blog post by slug
exports.getBlogPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await db.query(
      `SELECT * FROM blog_posts
       WHERE slug = $1 AND status = 'published'`,
      [slug],
    );

    if (post.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Blog post not found",
      });
    }

    // Increment view count
    await db.query(
      "UPDATE blog_posts SET views_count = views_count + 1 WHERE id = $1",
      [post.rows[0].id],
    );

    // Get related posts
    const related = await db.query(
      `SELECT * FROM blog_posts
       WHERE category = $1 
       AND id != $2
       AND status = 'published'
       ORDER BY published_at DESC
       LIMIT 3`,
      [post.rows[0].category, post.rows[0].id],
    );

    res.json({
      success: true,
      post: post.rows[0],
      relatedPosts: related.rows,
    });
  } catch (error) {
    console.error("Get blog post by slug error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog post",
    });
  }
};

module.exports = exports;
