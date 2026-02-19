// src/controllers/adminController.js
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// ==================== SERVICES MANAGEMENT ====================

exports.createService = async (req, res) => {
  try {
    const {
      name,
      slug,
      category,
      tagline,
      description,
      features,
      deliverables,
      technologies,
      pricing_starts_at,
      pricing_model,
      timeline,
      is_featured,
      is_active,
      display_order,
      icon,
      thumbnail,
      hero_image,
      process_steps,
      faqs,
      meta_title,
      meta_description,
      meta_keywords,
    } = req.body;

    if (!name || !slug || !category) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Name, slug, and category are required",
        });
    }

    const existing = await db.query("SELECT id FROM services WHERE slug = $1", [
      slug,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "A service with this slug already exists",
        });
    }

    const service = await db.query(
      `INSERT INTO services 
       (id, name, slug, category, tagline, description, features, deliverables,
        technologies, pricing_starts_at, pricing_model, timeline, is_featured,
        is_active, display_order, icon, thumbnail, hero_image, process_steps,
        faqs, meta_title, meta_description, meta_keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [
        uuidv4(),
        name,
        slug,
        category,
        tagline || null,
        description || null,
        features ? JSON.stringify(features) : null,
        deliverables ? JSON.stringify(deliverables) : null,
        technologies ? JSON.stringify(technologies) : null,
        pricing_starts_at || null,
        pricing_model || "fixed",
        timeline || null,
        is_featured || false,
        is_active !== undefined ? is_active : true,
        display_order || 0,
        icon || null,
        thumbnail || null,
        hero_image || null,
        process_steps ? JSON.stringify(process_steps) : null,
        faqs ? JSON.stringify(faqs) : null,
        meta_title || name,
        meta_description || null,
        meta_keywords ? JSON.stringify(meta_keywords) : null,
      ],
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Service created successfully",
        service: service.rows[0],
      });
  } catch (error) {
    console.error("Create service error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create service",
        details: error.message,
      });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = [];
    const setClause = fields
      .map((field, index) => {
        values.push(updates[field]);
        return `${field} = $${index + 1}`;
      })
      .join(", ");
    values.push(id);

    const service = await db.query(
      `UPDATE services SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (service.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Service not found" });

    res.json({
      success: true,
      message: "Service updated successfully",
      service: service.rows[0],
    });
  } catch (error) {
    console.error("Update service error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update service",
        details: error.message,
      });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM services WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Service not found" });
    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    console.error("Delete service error:", error);
    res.status(500).json({ success: false, error: "Failed to delete service" });
  }
};

// ==================== PROJECTS MANAGEMENT ====================

exports.getAllProjects = async (req, res) => {
  try {
    const { category, is_published, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let query = "SELECT * FROM portfolio_projects WHERE 1=1";
    let countQuery =
      "SELECT COUNT(*) as total FROM portfolio_projects WHERE 1=1";

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
      countQuery += ` AND category = $${params.length}`;
    }
    if (is_published !== undefined) {
      params.push(is_published === "true");
      query += ` AND is_published = $${params.length}`;
      countQuery += ` AND is_published = $${params.length}`;
    }

    const countParams = [...params];
    query += ` ORDER BY display_order ASC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const [projects, total] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

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
    console.error("Get all projects error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch projects" });
  }
};

exports.createProject = async (req, res) => {
  try {
    const {
      title,
      slug,
      category,
      service_name,
      client_name,
      client_logo,
      description,
      challenge,
      solution,
      results,
      technologies,
      features,
      team_size,
      duration,
      year,
      thumbnail,
      hero_image,
      gallery_images,
      demo_url,
      github_url,
      case_study_url,
      testimonial_id,
      is_featured,
      is_published,
      display_order,
      meta_title,
      meta_description,
      meta_keywords,
    } = req.body;

    if (!title || !slug)
      return res
        .status(400)
        .json({ success: false, error: "Title and slug are required" });

    const project = await db.query(
      `INSERT INTO portfolio_projects 
       (id, title, slug, category, service_name, client_name, client_logo,
        description, challenge, solution, results, technologies, features,
        team_size, duration, year, thumbnail, hero_image, gallery_images,
        demo_url, github_url, case_study_url, testimonial_id, is_featured,
        is_published, display_order, meta_title, meta_description, meta_keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING *`,
      [
        uuidv4(),
        title,
        slug,
        category || null,
        service_name || null,
        client_name || null,
        client_logo || null,
        description || null,
        challenge || null,
        solution || null,
        results ? JSON.stringify(results) : null,
        technologies ? JSON.stringify(technologies) : null,
        features ? JSON.stringify(features) : null,
        team_size || null,
        duration || null,
        year || new Date().getFullYear(),
        thumbnail || null,
        hero_image || null,
        gallery_images ? JSON.stringify(gallery_images) : null,
        demo_url || null,
        github_url || null,
        case_study_url || null,
        testimonial_id || null,
        is_featured || false,
        is_published !== undefined ? is_published : true,
        display_order || 0,
        meta_title || title,
        meta_description || null,
        meta_keywords ? JSON.stringify(meta_keywords) : null,
      ],
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Project created successfully",
        project: project.rows[0],
      });
  } catch (error) {
    console.error("Create project error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create project",
        details: error.message,
      });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = [];
    const setClause = fields
      .map((field, index) => {
        values.push(updates[field]);
        return `${field} = $${index + 1}`;
      })
      .join(", ");
    values.push(id);

    const project = await db.query(
      `UPDATE portfolio_projects SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (project.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Project not found" });

    res.json({
      success: true,
      message: "Project updated successfully",
      project: project.rows[0],
    });
  } catch (error) {
    console.error("Update project error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update project",
        details: error.message,
      });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM portfolio_projects WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Project not found" });
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ success: false, error: "Failed to delete project" });
  }
};

// ==================== TESTIMONIALS MANAGEMENT ====================

exports.getAllTestimonials = async (req, res) => {
  try {
    const { is_approved, is_featured, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (is_approved !== undefined) {
      params.push(is_approved === "true");
      conditions.push(`is_approved = $${params.length}`);
    }
    if (is_featured !== undefined) {
      params.push(is_featured === "true");
      conditions.push(`is_featured = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(parseInt(limit), parseInt(offset));
    const [testimonials, total] = await Promise.all([
      db.query(
        `SELECT * FROM testimonials ${where} ORDER BY display_order ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      db.query(
        `SELECT COUNT(*) as total FROM testimonials ${where}`,
        countParams,
      ),
    ]);

    res.json({
      success: true,
      testimonials: testimonials.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all testimonials error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch testimonials" });
  }
};

exports.createTestimonial = async (req, res) => {
  try {
    const {
      author_name,
      author_position,
      author_avatar,
      client_name,
      client_logo,
      content,
      rating,
      project_id,
      service_id,
      is_featured,
      is_approved,
      display_order,
    } = req.body;

    if (!author_name || !content)
      return res
        .status(400)
        .json({
          success: false,
          error: "Author name and content are required",
        });

    const testimonial = await db.query(
      `INSERT INTO testimonials 
       (id, author_name, author_position, author_avatar, client_name, client_logo,
        content, rating, project_id, service_id, is_featured, is_approved, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        uuidv4(),
        author_name,
        author_position || null,
        author_avatar || null,
        client_name || null,
        client_logo || null,
        content,
        rating || 5,
        project_id || null,
        service_id || null,
        is_featured || false,
        is_approved !== undefined ? is_approved : true,
        display_order || 0,
      ],
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Testimonial created successfully",
        testimonial: testimonial.rows[0],
      });
  } catch (error) {
    console.error("Create testimonial error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create testimonial",
        details: error.message,
      });
  }
};

exports.updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = [];
    const setClause = fields
      .map((field, index) => {
        values.push(updates[field]);
        return `${field} = $${index + 1}`;
      })
      .join(", ");
    values.push(id);

    const testimonial = await db.query(
      `UPDATE testimonials SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (testimonial.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Testimonial not found" });

    res.json({
      success: true,
      message: "Testimonial updated successfully",
      testimonial: testimonial.rows[0],
    });
  } catch (error) {
    console.error("Update testimonial error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update testimonial",
        details: error.message,
      });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM testimonials WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Testimonial not found" });
    res.json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error) {
    console.error("Delete testimonial error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete testimonial" });
  }
};

// ==================== TEAM MEMBERS MANAGEMENT ====================

exports.getAllTeamMembers = async (req, res) => {
  try {
    const { department, is_active, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (department) {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }
    if (is_active !== undefined && is_active !== "") {
      params.push(is_active === "true");
      conditions.push(`is_active = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(full_name ILIKE $${params.length} OR position ILIKE $${params.length} OR email ILIKE $${params.length})`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(parseInt(limit), parseInt(offset));
    const [members, total] = await Promise.all([
      db.query(
        `SELECT * FROM team_members ${where} ORDER BY display_order ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      db.query(
        `SELECT COUNT(*) as total FROM team_members ${where}`,
        countParams,
      ),
    ]);

    res.json({
      success: true,
      members: members.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all team members error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch team members" });
  }
};

exports.createTeamMember = async (req, res) => {
  try {
    const {
      full_name,
      position,
      department,
      bio,
      avatar,
      email,
      phone,
      linkedin_url,
      twitter_url,
      github_url,
      skills,
      is_leadership,
      is_active,
      display_order,
    } = req.body;

    if (!full_name || !position)
      return res
        .status(400)
        .json({ success: false, error: "Full name and position are required" });

    const member = await db.query(
      `INSERT INTO team_members 
       (id, full_name, position, department, bio, avatar, email, phone,
        linkedin_url, twitter_url, github_url, skills, is_leadership, is_active, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        uuidv4(),
        full_name,
        position,
        department || null,
        bio || null,
        avatar || null,
        email || null,
        phone || null,
        linkedin_url || null,
        twitter_url || null,
        github_url || null,
        skills ? JSON.stringify(skills) : null,
        is_leadership || false,
        is_active !== undefined ? is_active : true,
        display_order || 0,
      ],
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Team member created successfully",
        member: member.rows[0],
      });
  } catch (error) {
    console.error("Create team member error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create team member",
        details: error.message,
      });
  }
};

exports.updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = [];
    const setClause = fields
      .map((field, index) => {
        values.push(updates[field]);
        return `${field} = $${index + 1}`;
      })
      .join(", ");
    values.push(id);

    const member = await db.query(
      `UPDATE team_members SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (member.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Team member not found" });

    res.json({
      success: true,
      message: "Team member updated successfully",
      member: member.rows[0],
    });
  } catch (error) {
    console.error("Update team member error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update team member",
        details: error.message,
      });
  }
};

exports.deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM team_members WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Team member not found" });
    res.json({ success: true, message: "Team member deleted successfully" });
  } catch (error) {
    console.error("Delete team member error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete team member" });
  }
};

// ==================== BLOG POSTS MANAGEMENT ====================

exports.getAllBlogPosts = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(title ILIKE $${params.length} OR author_name ILIKE $${params.length} OR category ILIKE $${params.length})`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(parseInt(limit), parseInt(offset));
    const [posts, total] = await Promise.all([
      db.query(
        `SELECT * FROM blog_posts ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      db.query(
        `SELECT COUNT(*) as total FROM blog_posts ${where}`,
        countParams,
      ),
    ]);

    res.json({
      success: true,
      posts: posts.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all blog posts error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch blog posts" });
  }
};

exports.createBlogPost = async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      category,
      tags,
      author_id,
      author_name,
      featured_image,
      status,
      is_featured,
      published_at,
      meta_title,
      meta_description,
      meta_keywords,
    } = req.body;

    if (!title || !slug || !content)
      return res
        .status(400)
        .json({
          success: false,
          error: "Title, slug, and content are required",
        });

    const post = await db.query(
      `INSERT INTO blog_posts 
       (id, title, slug, excerpt, content, category, tags, author_id, author_name,
        featured_image, status, is_featured, published_at, meta_title, meta_description, meta_keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        uuidv4(),
        title,
        slug,
        excerpt || null,
        content,
        category || null,
        tags ? JSON.stringify(tags) : null,
        author_id || null,
        author_name || null,
        featured_image || null,
        status || "draft",
        is_featured || false,
        published_at || (status === "published" ? new Date() : null),
        meta_title || title,
        meta_description || excerpt || null,
        meta_keywords ? JSON.stringify(meta_keywords) : null,
      ],
    );

    res
      .status(201)
      .json({
        success: true,
        message: "Blog post created successfully",
        post: post.rows[0],
      });
  } catch (error) {
    console.error("Create blog post error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create blog post",
        details: error.message,
      });
  }
};

exports.updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.status === "published" && !updates.published_at)
      updates.published_at = new Date();

    const fields = Object.keys(updates);
    const values = [];
    const setClause = fields
      .map((field, index) => {
        values.push(updates[field]);
        return `${field} = $${index + 1}`;
      })
      .join(", ");
    values.push(id);

    const post = await db.query(
      `UPDATE blog_posts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (post.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Blog post not found" });

    res.json({
      success: true,
      message: "Blog post updated successfully",
      post: post.rows[0],
    });
  } catch (error) {
    console.error("Update blog post error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update blog post",
        details: error.message,
      });
  }
};

exports.deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM blog_posts WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Blog post not found" });
    res.json({ success: true, message: "Blog post deleted successfully" });
  } catch (error) {
    console.error("Delete blog post error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete blog post" });
  }
};

// ==================== LEADS MANAGEMENT ====================

exports.getAllLeads = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let query = "SELECT * FROM leads";
    let countQuery = "SELECT COUNT(*) as total FROM leads";

    if (status) {
      query += " WHERE status = $1";
      countQuery += " WHERE status = $1";
      params.push(status);
    }

    const countParams = [...params];
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const [leads, total] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    res.json({
      success: true,
      leads: leads.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get all leads error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch leads" });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!status)
      return res
        .status(400)
        .json({ success: false, error: "Status is required" });

    const lead = await db.query(
      `UPDATE leads SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [status, notes || null, id],
    );
    if (lead.rows.length === 0)
      return res.status(404).json({ success: false, error: "Lead not found" });

    res.json({
      success: true,
      message: "Lead status updated successfully",
      lead: lead.rows[0],
    });
  } catch (error) {
    console.error("Update lead status error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update lead status" });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM leads WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: "Lead not found" });
    res.json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({ success: false, error: "Failed to delete lead" });
  }
};

// ==================== NEWSLETTER SUBSCRIBERS MANAGEMENT ====================

exports.getAllSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      db.query(
        `SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), parseInt(offset)],
      ),
      db.query("SELECT COUNT(*) as total FROM newsletter_subscribers"),
    ]);

    res.json({
      success: true,
      subscribers: subscribers.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get all subscribers error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch subscribers" });
  }
};

exports.unsubscribeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await db.query(
      `UPDATE newsletter_subscribers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id],
    );
    if (subscriber.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Subscriber not found" });
    res.json({ success: true, message: "User unsubscribed successfully" });
  } catch (error) {
    console.error("Unsubscribe user error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to unsubscribe user" });
  }
};

exports.deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "Subscriber not found" });
    res.json({ success: true, message: "Subscriber deleted successfully" });
  } catch (error) {
    console.error("Delete subscriber error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete subscriber" });
  }
};

// ==================== DASHBOARD STATS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalServices,
      totalProjects,
      totalTestimonials,
      totalLeads,
      newLeads,
      totalSubscribers,
      totalBlogPosts,
      publishedPosts,
      recentLeads,
      leadsByStatus,
    ] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM services WHERE is_active = true"),
      db.query(
        "SELECT COUNT(*) as count FROM portfolio_projects WHERE is_published = true",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM testimonials WHERE is_approved = true",
      ),
      db.query("SELECT COUNT(*) as count FROM leads"),
      db.query("SELECT COUNT(*) as count FROM leads WHERE status = 'new'"),
      db.query(
        "SELECT COUNT(*) as count FROM newsletter_subscribers WHERE is_active = true",
      ),
      db.query("SELECT COUNT(*) as count FROM blog_posts"),
      db.query(
        "SELECT COUNT(*) as count FROM blog_posts WHERE status = 'published'",
      ),
      db.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5"),
      db.query("SELECT status, COUNT(*) as count FROM leads GROUP BY status"),
    ]);

    res.json({
      success: true,
      stats: {
        services: { total: parseInt(totalServices.rows[0].count) },
        projects: { total: parseInt(totalProjects.rows[0].count) },
        testimonials: { total: parseInt(totalTestimonials.rows[0].count) },
        leads: {
          total: parseInt(totalLeads.rows[0].count),
          new: parseInt(newLeads.rows[0].count),
          byStatus: leadsByStatus.rows,
          recent: recentLeads.rows,
        },
        subscribers: { total: parseInt(totalSubscribers.rows[0].count) },
        blog: {
          total: parseInt(totalBlogPosts.rows[0].count),
          published: parseInt(publishedPosts.rows[0].count),
        },
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch dashboard stats" });
  }
};

module.exports = exports;
