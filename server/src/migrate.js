require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { pool, query } = require("./db");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  await pool.query(sql);

  const adminUser = process.env.ADMIN_USER || "abouamjad";
  const adminPass = process.env.ADMIN_PASS || "Lallas123!";
  const adminToken = process.env.ADMIN_TOKEN || randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

  const existing = await query("SELECT id FROM users WHERE username = $1", [adminUser]);
  if (!existing.rows.length) {
    const hash = await bcrypt.hash(adminPass, 10);
    await query(
      `INSERT INTO users (username, password_hash, role, api_token)
       VALUES ($1, $2, 'admin', $3)`,
      [adminUser, hash, adminToken]
    );
    console.log("Created admin user:", adminUser);
    console.log("Admin API token:", adminToken);
  } else {
    console.log("Admin user already exists:", adminUser);
  }

  // Seed demo staff if missing
  const seeds = [
    { user: "staff1", pass: "Staff123!", role: "employee" },
    { user: "eng1", pass: "Eng123!", role: "engineer" },
  ];
  for (const s of seeds) {
    const r = await query("SELECT id FROM users WHERE username = $1", [s.user]);
    if (!r.rows.length) {
      const hash = await bcrypt.hash(s.pass, 10);
      await query(
        `INSERT INTO users (username, password_hash, role, api_token)
         VALUES ($1, $2, $3, $4)`,
        [s.user, hash, s.role, randomUUID().replace(/-/g, "")]
      );
      console.log("Created user:", s.user, s.role);
    }
  }

  await pool.end();
  console.log("Migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
