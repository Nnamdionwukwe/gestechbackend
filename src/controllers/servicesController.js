// src/controllers/servicesController.js
const db = require("../config/database");
const redis = require("../config/redis");
const { v4: uuidv4 } = require("uuid");

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const { category } = req.query;

    let query = `
      SELECT s.*, 
             COUNT(DISTINCT sp.id) as projects_count,
             AVG(sp.rating) as avg_rating
      FROM services s
      LEFT JOIN service_projects sp ON s.id = sp.service_id
      WHERE s.is_active = true
    `;

    const params = [];

    if (category) {
      query += ` AND s.category = $1`;
      params.push(category);
    }

    query += ` GROUP BY s.id ORDER BY s.display_order ASC, s.created_at DESC`;

    const services = await db.query(query, params);

    res.json({
      services: services.rows,
      categories: [
        "software-development",
        "mobile-app-development",
        "web-development",
        "ui-ux-design",
        "social-media-management",
        "digital-marketing",
        "branding",
        "consulting",
      ],
    });
  } catch (error) {
    console.error("Get all services error:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
};

// Get service by slug
exports.getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const service = await db.query(
      `SELECT s.*,
              COUNT(DISTINCT sp.id) as projects_count,
              AVG(sp.rating) as avg_rating
       FROM services s
       LEFT JOIN service_projects sp ON s.id = sp.service_id
       WHERE s.slug = $1 AND s.is_active = true
       GROUP BY s.id`,
      [slug],
    );

    if (service.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get related projects
    const projects = await db.query(
      `SELECT * FROM service_projects 
       WHERE service_id = $1 
       AND is_featured = true 
       ORDER BY created_at DESC 
       LIMIT 6`,
      [service.rows[0].id],
    );

    // Get testimonials
    const testimonials = await db.query(
      `SELECT t.* FROM testimonials t
       JOIN service_testimonials st ON t.id = st.testimonial_id
       WHERE st.service_id = $1
       ORDER BY t.created_at DESC
       LIMIT 4`,
      [service.rows[0].id],
    );

    res.json({
      service: service.rows[0],
      projects: projects.rows,
      testimonials: testimonials.rows,
    });
  } catch (error) {
    console.error("Get service by slug error:", error);
    res.status(500).json({ error: "Failed to fetch service" });
  }
};

// Get portfolio/projects
exports.getPortfolio = async (req, res) => {
  try {
    const { category, technology, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             s.name as service_name,
             s.category as service_category,
             array_agg(DISTINCT t.name) as technologies
      FROM service_projects p
      JOIN services s ON p.service_id = s.id
      LEFT JOIN project_technologies pt ON p.id = pt.project_id
      LEFT JOIN technologies t ON pt.technology_id = t.id
      WHERE p.is_published = true
    `;

    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND s.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (technology) {
      query += ` AND EXISTS (
        SELECT 1 FROM project_technologies pt2
        JOIN technologies t2 ON pt2.technology_id = t2.id
        WHERE pt2.project_id = p.id AND t2.slug = $${paramCount}
      )`;
      params.push(technology);
      paramCount++;
    }

    query += ` GROUP BY p.id, s.name, s.category
               ORDER BY p.created_at DESC
               LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

    params.push(limit, offset);

    const projects = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM service_projects p
      JOIN services s ON p.service_id = s.id
      WHERE p.is_published = true
    `;

    const countParams = [];
    let countParamIdx = 1;

    if (category) {
      countQuery += ` AND s.category = $${countParamIdx}`;
      countParams.push(category);
      countParamIdx++;
    }

    if (technology) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM project_technologies pt
        JOIN technologies t ON pt.technology_id = t.id
        WHERE pt.project_id = p.id AND t.slug = $${countParamIdx}
      )`;
      countParams.push(technology);
    }

    const total = await db.query(countQuery, countParams);

    res.json({
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
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
};

// Get project by slug
exports.getProjectBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const project = await db.query(
      `SELECT p.*, 
              s.name as service_name,
              s.category as service_category,
              c.name as client_name,
              c.logo as client_logo,
              array_agg(DISTINCT t.name) as technologies
       FROM service_projects p
       JOIN services s ON p.service_id = s.id
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN project_technologies pt ON p.id = pt.project_id
       LEFT JOIN technologies t ON pt.technology_id = t.id
       WHERE p.slug = $1 AND p.is_published = true
       GROUP BY p.id, s.name, s.category, c.name, c.logo`,
      [slug],
    );

    if (project.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get related projects
    const related = await db.query(
      `SELECT p.*, s.name as service_name
       FROM service_projects p
       JOIN services s ON p.service_id = s.id
       WHERE p.service_id = $1 
       AND p.id != $2
       AND p.is_published = true
       ORDER BY p.created_at DESC
       LIMIT 3`,
      [project.rows[0].service_id, project.rows[0].id],
    );

    res.json({
      project: project.rows[0],
      relatedProjects: related.rows,
    });
  } catch (error) {
    console.error("Get project by slug error:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
};

// Get testimonials
exports.getTestimonials = async (req, res) => {
  try {
    const { service, featured } = req.query;

    let query = `
      SELECT t.*, 
             c.name as client_name,
             c.logo as client_logo,
             c.industry as client_industry,
             array_agg(DISTINCT s.name) as services
      FROM testimonials t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN service_testimonials st ON t.id = st.testimonial_id
      LEFT JOIN services s ON st.service_id = s.id
      WHERE t.is_published = true
    `;

    const params = [];
    let paramCount = 1;

    if (featured === "true") {
      query += ` AND t.is_featured = true`;
    }

    if (service) {
      query += ` AND EXISTS (
        SELECT 1 FROM service_testimonials st2
        JOIN services s2 ON st2.service_id = s2.id
        WHERE st2.testimonial_id = t.id AND s2.slug = $${paramCount}
      )`;
      params.push(service);
      paramCount++;
    }

    query += ` GROUP BY t.id, c.name, c.logo, c.industry
               ORDER BY t.created_at DESC`;

    const testimonials = await db.query(query, params);

    res.json({ testimonials: testimonials.rows });
  } catch (error) {
    console.error("Get testimonials error:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
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
    res.status(500).json({ error: "Failed to fetch team members" });
  }
};

// Submit contact form
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, company, service, budget, message, timeline } =
      req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        error: "Name, email, and message are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const inquiry = await db.query(
      `INSERT INTO contact_inquiries
       (id, name, email, phone, company, service_interest, 
        budget_range, message, timeline, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', NOW())
       RETURNING *`,
      [
        uuidv4(),
        name,
        email,
        phone,
        company,
        service,
        budget,
        message,
        timeline,
      ],
    );

    // TODO: Send email notification to admin
    // TODO: Send auto-reply to user

    res.status(201).json({
      success: true,
      message: "Thank you! We'll get back to you within 24 hours.",
      inquiry: inquiry.rows[0],
    });
  } catch (error) {
    console.error("Submit contact form error:", error);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
};

// Subscribe to newsletter
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if already subscribed
    const existing = await db.query(
      "SELECT id FROM newsletter_subscribers WHERE email = $1",
      [email],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "This email is already subscribed",
      });
    }

    await db.query(
      `INSERT INTO newsletter_subscribers
       (id, email, name, status, subscribed_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [uuidv4(), email, name],
    );

    res.json({
      success: true,
      message: "Successfully subscribed to our newsletter!",
    });
  } catch (error) {
    console.error("Subscribe newsletter error:", error);
    res.status(500).json({ error: "Failed to subscribe" });
  }
};

// Get technologies/tech stack
exports.getTechnologies = async (req, res) => {
  try {
    const technologies = await db.query(
      `SELECT t.*, 
              COUNT(DISTINCT pt.project_id) as projects_count
       FROM technologies t
       LEFT JOIN project_technologies pt ON t.id = pt.id
       WHERE t.is_active = true
       GROUP BY t.id
       ORDER BY t.category ASC, t.name ASC`,
    );

    // Group by category
    const grouped = technologies.rows.reduce((acc, tech) => {
      if (!acc[tech.category]) {
        acc[tech.category] = [];
      }
      acc[tech.category].push(tech);
      return acc;
    }, {});

    res.json({
      technologies: technologies.rows,
      byCategory: grouped,
    });
  } catch (error) {
    console.error("Get technologies error:", error);
    res.status(500).json({ error: "Failed to fetch technologies" });
  }
};

// Get blog posts
exports.getBlogPosts = async (req, res) => {
  try {
    const { category, tag, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             a.name as author_name,
             a.avatar as author_avatar,
             array_agg(DISTINCT t.name) as tags
      FROM blog_posts p
      LEFT JOIN team_members a ON p.author_id = a.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.is_published = true
    `;

    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (tag) {
      query += ` AND EXISTS (
        SELECT 1 FROM post_tags pt2
        JOIN tags t2 ON pt2.tag_id = t2.id
        WHERE pt2.post_id = p.id AND t2.slug = $${paramCount}
      )`;
      params.push(tag);
      paramCount++;
    }

    query += ` GROUP BY p.id, a.name, a.avatar
               ORDER BY p.published_at DESC
               LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

    params.push(limit, offset);

    const posts = await db.query(query, params);

    // Get total
    let countQuery = `SELECT COUNT(*) as total FROM blog_posts WHERE is_published = true`;
    const countParams = [];
    let countIdx = 1;

    if (category) {
      countQuery += ` AND category = $${countIdx}`;
      countParams.push(category);
      countIdx++;
    }

    if (tag) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM post_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.post_id = blog_posts.id AND t.slug = $${countIdx}
      )`;
      countParams.push(tag);
    }

    const total = await db.query(countQuery, countParams);

    res.json({
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
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
};

// Get blog post by slug
exports.getBlogPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await db.query(
      `SELECT p.*, 
              a.name as author_name,
              a.avatar as author_avatar,
              a.bio as author_bio,
              array_agg(DISTINCT t.name) as tags
       FROM blog_posts p
       LEFT JOIN team_members a ON p.author_id = a.id
       LEFT JOIN post_tags pt ON p.id = pt.post_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.slug = $1 AND p.is_published = true
       GROUP BY p.id, a.name, a.avatar, a.bio`,
      [slug],
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    // Increment view count
    await db.query(
      "UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1",
      [post.rows[0].id],
    );

    // Get related posts
    const related = await db.query(
      `SELECT p.*, a.name as author_name
       FROM blog_posts p
       LEFT JOIN team_members a ON p.author_id = a.id
       WHERE p.category = $1 
       AND p.id != $2
       AND p.is_published = true
       ORDER BY p.published_at DESC
       LIMIT 3`,
      [post.rows[0].category, post.rows[0].id],
    );

    res.json({
      post: post.rows[0],
      relatedPosts: related.rows,
    });
  } catch (error) {
    console.error("Get blog post by slug error:", error);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
};

module.exports = exports;
