require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { pool, query } = require("./db");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  await pool.query(sql);

  const tsSql = fs.readFileSync(path.join(__dirname, "..", "sql", "timesheet_schema.sql"), "utf8");
  await pool.query(tsSql);
  console.log("Timesheet schema applied");

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

  // Timesheet demo seed (isolated — safe to skip if tables missing)
  try {
    const demoProject = await query(`SELECT id FROM ts_projects WHERE code = 'DEMO01' LIMIT 1`);
    let projectId = demoProject.rows[0]?.id;
    if (!projectId) {
      const secret = randomUUID().replace(/-/g, "").slice(0, 16);
      const ins = await query(
        `INSERT INTO ts_projects (code, name, description, geofence_lat, geofence_lng, geofence_radius_m, qr_secret, created_by)
         VALUES ('DEMO01','Demo Site','Timesheet demo project',24.7136,46.6753,500,$1,'system')
         RETURNING id`,
        [secret]
      );
      projectId = ins.rows[0].id;
      console.log("Created demo timesheet project DEMO01");
    }

    const tsSeeds = [
      { user: "staff1", code: "STAFF1", name: "Staff One" },
      { user: "eng1", code: "ENG1", name: "Engineer One" },
      { user: adminUser, code: "ADMIN", name: "System Admin" },
    ];
    for (const s of tsSeeds) {
      const ur = await query(`SELECT id FROM users WHERE username = $1`, [s.user]);
      const uid = ur.rows[0]?.id;
      const ex = await query(`SELECT id FROM ts_employees WHERE username = $1`, [s.user]);
      let empId = ex.rows[0]?.id;
      if (!empId) {
        const ins = await query(
          `INSERT INTO ts_employees (user_id, username, employee_code, full_name, status)
           VALUES ($1,$2,$3,$4,'active') RETURNING id`,
          [uid, s.user, s.code, s.name]
        );
        empId = ins.rows[0].id;
        console.log("Created ts_employee:", s.user);
      }
      if (s.user === "staff1" && projectId) {
        await query(
          `INSERT INTO ts_project_workers (project_id, employee_id, assigned_by)
           VALUES ($1,$2,'system') ON CONFLICT DO NOTHING`,
          [projectId, empId]
        );
      }
      if (s.user === "eng1" && projectId) {
        await query(
          `INSERT INTO ts_project_engineers (project_id, username, assigned_by)
           VALUES ($1,$2,'system') ON CONFLICT DO NOTHING`,
          [projectId, s.user]
        );
      }
    }
  } catch (e) {
    console.warn("Timesheet seed skipped:", e.message);
  }

  await pool.end();
  console.log("Migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
