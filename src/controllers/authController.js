// src/controllers/authController.js
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ==================== USER REGISTRATION ====================

exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: "Email, password, and full name are required",
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

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Check if user exists
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const user = await db.query(
      `INSERT INTO users 
       (id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [uuidv4(), email.toLowerCase(), password_hash, full_name, role || "user"],
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register user",
      details: error.message,
    });
  }
};

// ==================== USER LOGIN ====================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find user
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1 AND is_active = true",
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Update last login
    await db.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id],
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Remove password hash from response
    delete user.password_hash;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to login",
      details: error.message,
    });
  }
};

exports.googleVerify = async (req, res) => {
  try {
    console.log("Google verify request received");
    const { idToken } = req.body;

    if (!idToken) {
      console.log("No idToken provided");
      return res.status(400).json({ error: "ID token required" });
    }

    console.log("Verifying token with Google...");
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleProfile = ticket.getPayload();
    const { sub: googleId, email, name, picture } = googleProfile;
    console.log("Google profile verified:", { googleId, email, name });

    let oauthAccount = await db.query(
      "SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2",
      ["google", googleId],
    );

    let user;
    let isNewUser = false;

    if (oauthAccount.rows.length > 0) {
      console.log("Existing user found:", oauthAccount.rows[0].user_id);
      user = await db.query("SELECT * FROM users WHERE id = $1", [
        oauthAccount.rows[0].user_id,
      ]);
    } else {
      console.log("Creating new user for Google ID:", googleId);
      isNewUser = true;
      const userId = uuidv4();

      // Use email instead of google_{googleId} for phone_number
      // Or use NULL if phone_number is nullable
      const createdUser = await db.query(
        `INSERT INTO users (id, phone_number, email, full_name, profile_image, signup_method, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'google', TRUE, NOW(), NOW())
         RETURNING id, phone_number, email, full_name, profile_image`,
        [userId, null, email, name, picture], // phone_number = null for Google users
      );

      await db.query(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, profile_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          uuidv4(),
          userId,
          "google",
          googleId,
          email,
          JSON.stringify(googleProfile),
        ],
      );

      user = createdUser;
      console.log("New user created:", userId);
    }

    const { accessToken, refreshToken } = generateTokens(user.rows[0].id);

    await redis.set(
      `refresh_token:${user.rows[0].id}`,
      refreshToken,
      "EX",
      604800,
    );

    console.log("Google auth successful for user:", user.rows[0].id);

    res.json({
      success: true,
      isNewUser,
      user: {
        id: user.rows[0].id,
        phone_number: user.rows[0].phone_number,
        email: user.rows[0].email,
        full_name: user.rows[0].full_name,
        profile_image: user.rows[0].profile_image,
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (error) {
    console.error("Google verification error:", error);
    console.error("Error stack:", error.stack);
    res.status(401).json({
      error: "Token verification failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ==================== GET CURRENT USER ====================

exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await db.query(
      "SELECT id, email, full_name, role, avatar, phone, is_active, created_at, last_login FROM users WHERE id = $1",
      [req.user.id],
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user",
    });
  }
};

// ==================== UPDATE PROFILE ====================

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, phone, avatar } = req.body;

    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");

    values.push(req.user.id);

    const user = await db.query(
      `UPDATE users 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, email, full_name, role, avatar, phone, is_active, created_at, last_login`,
      values,
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

// ==================== CHANGE PASSWORD ====================

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are required",
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters long",
      });
    }

    // Get user with password hash
    const result = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      current_password,
      result.rows[0].password_hash,
    );

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const new_password_hash = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [new_password_hash, req.user.id],
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
};

// ==================== FORGOT PASSWORD ====================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    // Check if user exists
    const user = await db.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email.toLowerCase()],
    );

    // Always return success to prevent email enumeration
    if (user.rows.length === 0) {
      return res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Store reset token in database
    await db.query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour'
       WHERE id = $2`,
      [resetToken, user.rows[0].id],
    );

    // TODO: Send email with reset link
    // For now, return the token (in production, only send via email)
    console.log("Password reset token:", resetToken);
    console.log(
      "Reset link: http://localhost:3000/reset-password?token=" + resetToken,
    );

    res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent",
      // Remove in production:
      resetToken,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process password reset request",
    });
  }
};

// ==================== RESET PASSWORD ====================

exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        error: "Token and new password are required",
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token",
      });
    }

    // Check if token exists in database and is not expired
    const user = await db.query(
      `SELECT id FROM users 
       WHERE id = $1 
       AND reset_token = $2 
       AND reset_token_expires > NOW()`,
      [decoded.id, token],
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    // Update password and clear reset token
    await db.query(
      `UPDATE users 
       SET password_hash = $1, 
           reset_token = NULL, 
           reset_token_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [password_hash, decoded.id],
    );

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset password",
    });
  }
};

// ==================== ADMIN: GET ALL USERS ====================

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, full_name, role, avatar, phone, is_active, created_at, last_login
      FROM users
    `;
    const params = [];

    if (role) {
      query += " WHERE role = $1";
      params.push(role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const users = await db.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM users";
    const countParams = [];

    if (role) {
      countQuery += " WHERE role = $1";
      countParams.push(role);
    }

    const total = await db.query(countQuery, countParams);

    res.json({
      success: true,
      users: users.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows[0].total),
        pages: Math.ceil(total.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
    });
  }
};

// ==================== ADMIN: UPDATE USER ROLE ====================

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: "Role is required",
      });
    }

    const validRoles = ["user", "admin", "editor"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
      });
    }

    const user = await db.query(
      `UPDATE users 
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active`,
      [role, id],
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user role",
    });
  }
};

// ==================== ADMIN: TOGGLE USER STATUS ====================

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.query(
      `UPDATE users 
       SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, full_name, role, is_active`,
      [id],
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User ${user.rows[0].is_active ? "activated" : "deactivated"} successfully`,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle user status",
    });
  }
};

module.exports = exports;
