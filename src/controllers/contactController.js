// src/controllers/contactController.js
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

class ContactController {
  /**
   * Submit contact form (Public)
   * POST /api/contact
   */
  async submitContactForm(req, res) {
    try {
      const {
        name,
        email,
        phone,
        company,
        service,
        budget,
        message,
        timeline,
      } = req.body;

      // Validation
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          error: "Name, email, and message are required",
        });
      }

      if (!service) {
        return res.status(400).json({
          success: false,
          error: "Please select a service",
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

      // Insert into leads table
      const inquiry = await db.query(
        `INSERT INTO leads
         (id, full_name, email, phone, company, service_interest, 
          budget_range, message, timeline, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', 'contact_form')
         RETURNING *`,
        [
          uuidv4(),
          name,
          email,
          phone || null,
          company || null,
          service,
          budget || null,
          message,
          timeline || null,
        ],
      );

      // TODO: Send email notification to admin
      // TODO: Send auto-reply to customer

      res.status(201).json({
        success: true,
        message: "Thank you! We'll get back to you within 24 hours.",
        inquiry: {
          id: inquiry.rows[0].id,
          name: inquiry.rows[0].full_name,
          email: inquiry.rows[0].email,
        },
      });
    } catch (error) {
      console.error("Submit contact form error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to submit inquiry",
        message: error.message,
      });
    }
  }

  /**
   * Subscribe to newsletter (Public)
   * POST /api/contact/newsletter
   */
  async subscribeNewsletter(req, res) {
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
        `INSERT INTO newsletter_subscribers (id, email, full_name, is_active, source)
         VALUES ($1, $2, $3, true, 'website')`,
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
  }

  /**
   * Get all leads (Admin)
   * GET /api/admin/contact/leads
   */
  async getAllLeads(req, res) {
    try {
      const {
        status,
        service,
        page = 1,
        limit = 20,
        search,
        start_date,
        end_date,
        sort_by = "created_at",
        sort_order = "DESC",
      } = req.query;

      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id,
          full_name,
          email,
          phone,
          company,
          service_interest,
          budget_range,
          message,
          timeline,
          status,
          source,
          notes,
          created_at,
          updated_at
        FROM leads
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      // Status filter
      if (status) {
        paramCount++;
        params.push(status);
        query += ` AND status = $${paramCount}`;
      }

      // Service filter
      if (service) {
        paramCount++;
        params.push(service);
        query += ` AND service_interest = $${paramCount}`;
      }

      // Search filter
      if (search) {
        paramCount++;
        params.push(`%${search}%`);
        query += ` AND (
          full_name ILIKE $${paramCount} OR
          email ILIKE $${paramCount} OR
          company ILIKE $${paramCount} OR
          message ILIKE $${paramCount}
        )`;
      }

      // Date range filter
      if (start_date && end_date) {
        paramCount++;
        params.push(start_date);
        paramCount++;
        params.push(end_date);
        query += ` AND created_at BETWEEN $${paramCount - 1} AND $${paramCount}`;
      }

      // Sorting
      const validSortColumns = [
        "created_at",
        "full_name",
        "status",
        "service_interest",
      ];
      const sortColumn = validSortColumns.includes(sort_by)
        ? sort_by
        : "created_at";
      const sortDirection = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

      query += ` ORDER BY ${sortColumn} ${sortDirection}`;

      // Pagination
      paramCount++;
      params.push(parseInt(limit));
      paramCount++;
      params.push(parseInt(offset));
      query += ` LIMIT $${paramCount - 1} OFFSET $${paramCount}`;

      const leads = await db.query(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM leads WHERE 1=1";
      const countParams = [];
      let countParamCount = 0;

      if (status) {
        countParamCount++;
        countParams.push(status);
        countQuery += ` AND status = $${countParamCount}`;
      }

      if (service) {
        countParamCount++;
        countParams.push(service);
        countQuery += ` AND service_interest = $${countParamCount}`;
      }

      if (search) {
        countParamCount++;
        countParams.push(`%${search}%`);
        countQuery += ` AND (
          full_name ILIKE $${countParamCount} OR
          email ILIKE $${countParamCount} OR
          company ILIKE $${countParamCount} OR
          message ILIKE $${countParamCount}
        )`;
      }

      if (start_date && end_date) {
        countParamCount++;
        countParams.push(start_date);
        countParamCount++;
        countParams.push(end_date);
        countQuery += ` AND created_at BETWEEN $${countParamCount - 1} AND $${countParamCount}`;
      }

      const totalResult = await db.query(countQuery, countParams);
      const total = parseInt(totalResult.rows[0].total);

      res.json({
        success: true,
        data: {
          leads: leads.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get all leads error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch leads",
        message: error.message,
      });
    }
  }

  /**
   * Get single lead (Admin)
   * GET /api/admin/contact/leads/:id
   */
  async getLeadById(req, res) {
    try {
      const { id } = req.params;

      const lead = await db.query("SELECT * FROM leads WHERE id = $1", [id]);

      if (lead.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Lead not found",
        });
      }

      res.json({
        success: true,
        data: lead.rows[0],
      });
    } catch (error) {
      console.error("Get lead by ID error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch lead",
        message: error.message,
      });
    }
  }

  /**
   * Update lead status (Admin)
   * PUT /api/admin/contact/leads/:id/status
   */
  async updateLeadStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const validStatuses = [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status",
        });
      }

      const lead = await db.query(
        `UPDATE leads 
         SET status = $1, 
             notes = COALESCE($2, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [status, notes || null, id],
      );

      if (lead.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Lead not found",
        });
      }

      res.json({
        success: true,
        message: "Lead status updated successfully",
        data: lead.rows[0],
      });
    } catch (error) {
      console.error("Update lead status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update lead status",
        message: error.message,
      });
    }
  }

  /**
   * Add notes to lead (Admin)
   * PUT /api/admin/contact/leads/:id/notes
   */
  async addNotesToLead(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({
          success: false,
          error: "Notes are required",
        });
      }

      const lead = await db.query(
        `UPDATE leads 
         SET notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [notes, id],
      );

      if (lead.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Lead not found",
        });
      }

      res.json({
        success: true,
        message: "Notes added successfully",
        data: lead.rows[0],
      });
    } catch (error) {
      console.error("Add notes to lead error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add notes",
        message: error.message,
      });
    }
  }

  /**
   * Delete lead (Admin)
   * DELETE /api/admin/contact/leads/:id
   */
  async deleteLead(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        "DELETE FROM leads WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Lead not found",
        });
      }

      res.json({
        success: true,
        message: "Lead deleted successfully",
      });
    } catch (error) {
      console.error("Delete lead error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete lead",
        message: error.message,
      });
    }
  }

  /**
   * Get lead statistics (Admin)
   * GET /api/admin/contact/stats
   */
  async getLeadStats(req, res) {
    try {
      const { start_date, end_date } = req.query;

      let dateFilter = "";
      const params = [];

      if (start_date && end_date) {
        params.push(start_date, end_date);
        dateFilter = " WHERE created_at BETWEEN $1 AND $2";
      }

      // Overall stats
      const statsResult = await db.query(
        `
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
          COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN status = 'proposal' THEN 1 END) as proposal_leads,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won_leads,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_leads,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as leads_last_7_days,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as leads_last_30_days
        FROM leads
        ${dateFilter}
      `,
        params,
      );

      // Leads by service
      const serviceResult = await db.query(
        `
        SELECT 
          service_interest,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won_count,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count
        FROM leads
        ${dateFilter}
        GROUP BY service_interest
        ORDER BY count DESC
      `,
        params,
      );

      // Leads by source
      const sourceResult = await db.query(
        `
        SELECT 
          source,
          COUNT(*) as count
        FROM leads
        ${dateFilter}
        GROUP BY source
        ORDER BY count DESC
      `,
        params,
      );

      // Daily leads (last 30 days)
      const dailyResult = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count
        FROM leads
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // Conversion funnel
      const funnelResult = await db.query(
        `
        SELECT 
          status,
          COUNT(*) as count
        FROM leads
        ${dateFilter}
        GROUP BY status
        ORDER BY 
          CASE status
            WHEN 'new' THEN 1
            WHEN 'contacted' THEN 2
            WHEN 'qualified' THEN 3
            WHEN 'proposal' THEN 4
            WHEN 'negotiation' THEN 5
            WHEN 'won' THEN 6
            WHEN 'lost' THEN 7
          END
      `,
        params,
      );

      res.json({
        success: true,
        data: {
          overview: statsResult.rows[0],
          by_service: serviceResult.rows,
          by_source: sourceResult.rows,
          daily_leads: dailyResult.rows,
          funnel: funnelResult.rows,
        },
      });
    } catch (error) {
      console.error("Get lead stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch statistics",
        message: error.message,
      });
    }
  }

  /**
   * Export leads to CSV (Admin)
   * GET /api/admin/contact/leads/export
   */
  async exportLeads(req, res) {
    try {
      const { status, service, start_date, end_date } = req.query;

      let query = "SELECT * FROM leads WHERE 1=1";
      const params = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        params.push(status);
        query += ` AND status = $${paramCount}`;
      }

      if (service) {
        paramCount++;
        params.push(service);
        query += ` AND service_interest = $${paramCount}`;
      }

      if (start_date && end_date) {
        paramCount++;
        params.push(start_date);
        paramCount++;
        params.push(end_date);
        query += ` AND created_at BETWEEN $${paramCount - 1} AND $${paramCount}`;
      }

      query += " ORDER BY created_at DESC";

      const leads = await db.query(query, params);

      // Convert to CSV
      const headers = [
        "ID",
        "Name",
        "Email",
        "Phone",
        "Company",
        "Service",
        "Budget",
        "Message",
        "Status",
        "Source",
        "Created At",
      ];

      const csvRows = [headers.join(",")];

      leads.rows.forEach((lead) => {
        const row = [
          lead.id,
          `"${lead.full_name || ""}"`,
          lead.email,
          lead.phone || "",
          `"${lead.company || ""}"`,
          lead.service_interest || "",
          `"${lead.budget_range || ""}"`,
          `"${(lead.message || "").replace(/"/g, '""')}"`,
          lead.status,
          lead.source || "",
          new Date(lead.created_at).toISOString(),
        ];
        csvRows.push(row.join(","));
      });

      const csv = csvRows.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=leads-${Date.now()}.csv`,
      );
      res.send(csv);
    } catch (error) {
      console.error("Export leads error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export leads",
        message: error.message,
      });
    }
  }

  /**
   * Get all newsletter subscribers (Admin)
   * GET /api/admin/contact/subscribers
   */
  async getAllSubscribers(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id,
          email,
          full_name,
          source,
          is_active,
          created_at,
          updated_at
        FROM newsletter_subscribers
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        params.push(`%${search}%`);
        query += ` AND (email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const subscribers = await db.query(query, params);

      // Get total count
      let countQuery =
        "SELECT COUNT(*) as total FROM newsletter_subscribers WHERE 1=1";
      const countParams = [];

      if (search) {
        countParams.push(`%${search}%`);
        countQuery += " AND (email ILIKE $1 OR full_name ILIKE $1)";
      }

      const totalResult = await db.query(countQuery, countParams);
      const total = parseInt(totalResult.rows[0].total);

      res.json({
        success: true,
        data: {
          subscribers: subscribers.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get all subscribers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch subscribers",
        message: error.message,
      });
    }
  }

  /**
   * Unsubscribe user (Admin)
   * PUT /api/admin/contact/subscribers/:id/unsubscribe
   */
  async unsubscribeUser(req, res) {
    try {
      const { id } = req.params;

      const subscriber = await db.query(
        `UPDATE newsletter_subscribers 
         SET is_active = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id],
      );

      if (subscriber.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Subscriber not found",
        });
      }

      res.json({
        success: true,
        message: "User unsubscribed successfully",
      });
    } catch (error) {
      console.error("Unsubscribe user error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to unsubscribe user",
        message: error.message,
      });
    }
  }

  /**
   * Delete subscriber (Admin)
   * DELETE /api/admin/contact/subscribers/:id
   */
  async deleteSubscriber(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        "DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Subscriber not found",
        });
      }

      res.json({
        success: true,
        message: "Subscriber deleted successfully",
      });
    } catch (error) {
      console.error("Delete subscriber error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete subscriber",
        message: error.message,
      });
    }
  }
}

module.exports = new ContactController();
