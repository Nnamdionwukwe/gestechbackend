// src/controllers/analyticsController.js
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// ==================== TRACK PAGE VIEW ====================

// Helper: detect device type from user agent
function detectDevice(ua = "") {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua))
    return "mobile";
  return "desktop";
}

// ── GET /api/admin/analytics?days=30 ─────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);

    const [summary, daily, topPages, referrers, devices, recent, todayRow] =
      await Promise.all([
        // Summary totals
        db.query(
          `SELECT
             COUNT(*)                      AS total_visits,
             COUNT(DISTINCT ip_hash)       AS unique_visitors
           FROM page_views
           WHERE created_at >= NOW() - INTERVAL '${days} days'`,
        ),

        // Daily breakdown
        db.query(
          `SELECT
             DATE(created_at)  AS day,
             COUNT(*)          AS visits
           FROM page_views
           WHERE created_at >= NOW() - INTERVAL '${days} days'
           GROUP BY day
           ORDER BY day ASC`,
        ),

        // Top pages
        db.query(
          `SELECT
             path,
             COUNT(*) AS visits
           FROM page_views
           WHERE created_at >= NOW() - INTERVAL '${days} days'
           GROUP BY path
           ORDER BY visits DESC
           LIMIT 10`,
        ),

        // Traffic sources
        db.query(
          `SELECT
             COALESCE(
               CASE
                 WHEN referrer IS NULL OR referrer = '' THEN NULL
                 WHEN referrer LIKE '%google%'   THEN 'google.com'
                 WHEN referrer LIKE '%facebook%' THEN 'facebook.com'
                 WHEN referrer LIKE '%twitter%'  THEN 'twitter.com'
                 WHEN referrer LIKE '%instagram%'THEN 'instagram.com'
                 WHEN referrer LIKE '%linkedin%' THEN 'linkedin.com'
                 ELSE regexp_replace(referrer, '^https?://([^/]+).*', '\1')
               END,
               'Direct / None'
             ) AS referrer,
             COUNT(*) AS visits
           FROM page_views
           WHERE created_at >= NOW() - INTERVAL '${days} days'
           GROUP BY referrer
           ORDER BY visits DESC
           LIMIT 8`,
        ),

        // Device totals — computed from user_agent in JS
        db.query(
          `SELECT user_agent, COUNT(*) AS count
           FROM page_views
           WHERE created_at >= NOW() - INTERVAL '${days} days'
           GROUP BY user_agent`,
        ),

        // Recent 50 rows
        db.query(
          `SELECT path, referrer, user_agent, created_at
           FROM page_views
           ORDER BY created_at DESC
           LIMIT 50`,
        ),

        // Today's count
        db.query(
          `SELECT COUNT(*) AS count
           FROM page_views
           WHERE created_at >= CURRENT_DATE`,
        ),
      ]);

    // Aggregate device types
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
    for (const { user_agent, count } of devices.rows) {
      const type = detectDevice(user_agent || "");
      deviceCounts[type] += parseInt(count);
    }

    // Attach device type to recent rows
    const recentWithDevice = recent.rows.map((r) => ({
      ...r,
      device: detectDevice(r.user_agent || ""),
    }));

    res.json({
      summary: {
        total_visits: parseInt(summary.rows[0]?.total_visits || 0),
        unique_visitors: parseInt(summary.rows[0]?.unique_visitors || 0),
        today_visits: parseInt(todayRow.rows[0]?.count || 0),
      },
      daily: daily.rows.map((r) => ({
        day: r.day,
        visits: parseInt(r.visits),
      })),
      topPages: topPages.rows.map((r) => ({
        path: r.path,
        visits: parseInt(r.visits),
      })),
      referrers: referrers.rows.map((r) => ({
        referrer: r.referrer,
        visits: parseInt(r.visits),
      })),
      devices: deviceCounts,
      recent: recentWithDevice,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

exports.trackPageView = async (req, res) => {
  try {
    const { page_url, referrer } = req.body;
    if (!page_url) return res.status(400).json({ error: "page_url required" });

    const crypto = require("crypto");
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";
    const ipHash = crypto.createHash("sha256").update(rawIp).digest("hex");

    await db.query(
      `INSERT INTO page_views (id, path, ip_hash, user_agent, referrer, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [
        page_url,
        ipHash,
        req.headers["user-agent"] || null,
        referrer || req.headers["referer"] || null,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Track page view error:", error);
    res.status(500).json({ error: "Failed to track page view" });
  }
};
// ==================== TRACK EVENT ====================

exports.trackEvent = async (req, res) => {
  try {
    const { event_name, event_category, event_label, event_value, metadata } =
      req.body;

    if (!event_name || !event_category) {
      return res.status(400).json({
        success: false,
        error: "Event name and category are required",
      });
    }

    await db.query(
      `INSERT INTO events 
       (id, event_name, event_category, event_label, event_value, metadata, 
        user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        event_name,
        event_category,
        event_label || null,
        event_value || null,
        metadata ? JSON.stringify(metadata) : null,
        req.user?.id || null,
        req.ip || req.connection.remoteAddress,
        req.headers["user-agent"],
      ],
    );

    res.json({
      success: true,
      message: "Event tracked",
    });
  } catch (error) {
    console.error("Track event error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to track event",
    });
  }
};

// ==================== GET ANALYTICS SUMMARY ====================

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Default to last 30 days
    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date
      ? new Date(start_date)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Total page views
    const totalPageViews = await db.query(
      `SELECT COUNT(*) as count FROM page_views 
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate],
    );

    // Unique visitors (by IP)
    const uniqueVisitors = await db.query(
      `SELECT COUNT(DISTINCT ip_address) as count FROM page_views 
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate],
    );

    // Top pages
    const topPages = await db.query(
      `SELECT page_url, page_title, COUNT(*) as views
       FROM page_views
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY page_url, page_title
       ORDER BY views DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    // Top referrers
    const topReferrers = await db.query(
      `SELECT referrer, COUNT(*) as count
       FROM page_views
       WHERE created_at BETWEEN $1 AND $2
       AND referrer IS NOT NULL
       AND referrer != ''
       GROUP BY referrer
       ORDER BY count DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    // Page views by day
    const viewsByDay = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as views
       FROM page_views
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate, endDate],
    );

    // Top events
    const topEvents = await db.query(
      `SELECT event_name, event_category, COUNT(*) as count
       FROM events
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY event_name, event_category
       ORDER BY count DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    res.json({
      success: true,
      analytics: {
        period: {
          start: startDate,
          end: endDate,
        },
        summary: {
          total_page_views: parseInt(totalPageViews.rows[0].count),
          unique_visitors: parseInt(uniqueVisitors.rows[0].count),
        },
        top_pages: topPages.rows,
        top_referrers: topReferrers.rows,
        views_by_day: viewsByDay.rows,
        top_events: topEvents.rows,
      },
    });
  } catch (error) {
    console.error("Get analytics summary error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get analytics summary",
    });
  }
};

// ==================== GET PAGE ANALYTICS ====================

exports.getPageAnalytics = async (req, res) => {
  try {
    const { page_url } = req.query;

    if (!page_url) {
      return res.status(400).json({
        success: false,
        error: "Page URL is required",
      });
    }

    // Total views
    const totalViews = await db.query(
      "SELECT COUNT(*) as count FROM page_views WHERE page_url = $1",
      [page_url],
    );

    // Unique visitors
    const uniqueVisitors = await db.query(
      `SELECT COUNT(DISTINCT ip_address) as count FROM page_views 
       WHERE page_url = $1`,
      [page_url],
    );

    // Views over time (last 30 days)
    const viewsOverTime = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as views
       FROM page_views
       WHERE page_url = $1
       AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [page_url],
    );

    // Top referrers
    const topReferrers = await db.query(
      `SELECT referrer, COUNT(*) as count
       FROM page_views
       WHERE page_url = $1
       AND referrer IS NOT NULL
       AND referrer != ''
       GROUP BY referrer
       ORDER BY count DESC
       LIMIT 10`,
      [page_url],
    );

    res.json({
      success: true,
      page_url: page_url,
      analytics: {
        total_views: parseInt(totalViews.rows[0].count),
        unique_visitors: parseInt(uniqueVisitors.rows[0].count),
        views_over_time: viewsOverTime.rows,
        top_referrers: topReferrers.rows,
      },
    });
  } catch (error) {
    console.error("Get page analytics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get page analytics",
    });
  }
};

// ==================== GET EVENT ANALYTICS ====================

exports.getEventAnalytics = async (req, res) => {
  try {
    const { event_category, start_date, end_date } = req.query;

    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date
      ? new Date(start_date)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let query = `
      SELECT event_name, COUNT(*) as count
      FROM events
      WHERE created_at BETWEEN $1 AND $2
    `;
    const params = [startDate, endDate];

    if (event_category) {
      query += " AND event_category = $3";
      params.push(event_category);
    }

    query += " GROUP BY event_name ORDER BY count DESC";

    const events = await db.query(query, params);

    // Events by day
    let dayQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM events
      WHERE created_at BETWEEN $1 AND $2
    `;
    const dayParams = [startDate, endDate];

    if (event_category) {
      dayQuery += " AND event_category = $3";
      dayParams.push(event_category);
    }

    dayQuery += " GROUP BY DATE(created_at) ORDER BY date";

    const eventsByDay = await db.query(dayQuery, dayParams);

    res.json({
      success: true,
      period: {
        start: startDate,
        end: endDate,
      },
      category: event_category || "all",
      events: events.rows,
      events_by_day: eventsByDay.rows,
    });
  } catch (error) {
    console.error("Get event analytics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get event analytics",
    });
  }
};

module.exports = exports;
