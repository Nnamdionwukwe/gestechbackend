// add-admin-user.js
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function addAdminUser() {
  console.log("👤 Add Admin User\n");

  try {
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("❌ Users table does not exist!");
      console.log("Please create the users table first.\n");
      rl.close();
      await pool.end();
      return;
    }

    // Get user input
    const email = await question("Email: ");
    const fullName = await question("Full Name: ");
    const password = await question("Password: ");
    const role =
      (await question("Role (admin/editor/user) [admin]: ")) || "admin";

    if (!email || !fullName || !password) {
      console.log("\n❌ All fields are required!");
      rl.close();
      await pool.end();
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("\n❌ Invalid email format!");
      rl.close();
      await pool.end();
      return;
    }

    // Check if user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existing.rows.length > 0) {
      console.log("\n❌ User with this email already exists!");
      rl.close();
      await pool.end();
      return;
    }

    // Hash password
    console.log("\n🔐 Hashing password...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    console.log("💾 Creating user...");
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
       RETURNING id, email, full_name, role`,
      [email.toLowerCase(), passwordHash, fullName, role],
    );

    console.log("\n✅ User created successfully!\n");
    console.log("📧 Email:", result.rows[0].email);
    console.log("👤 Name:", result.rows[0].full_name);
    console.log("🔑 Role:", result.rows[0].role);
    console.log("🆔 ID:", result.rows[0].id);
    console.log("");
  } catch (error) {
    console.error("\n❌ Failed to create user:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

addAdminUser();
