const { randomUUID } = require("crypto");
const { query } = require("../db");
const { logTimesheetAudit } = require("./audit");

async function listEmployees() {
  const r = await query(
    `SELECT e.*, u.role AS user_role
     FROM ts_employees e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.full_name, e.username`
  );
  return r.rows.map(mapEmployee);
}

async function upsertEmployee({ user, payload }) {
  const username = String(payload.username || "").trim();
  const employeeCode = String(payload.employeeCode || payload.code || username).trim().toUpperCase();
  const fullName = String(payload.fullName || payload.name || username).trim();
  const phone = String(payload.phone || "").trim();
  const status = payload.status === "inactive" ? "inactive" : "active";
  if (!username) return { error: "USERNAME_REQUIRED" };

  let userId = null;
  const ur = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
  if (ur.rows[0]) userId = ur.rows[0].id;

  const existing = await query(`SELECT * FROM ts_employees WHERE username = $1 LIMIT 1`, [username]);
  let row;
  if (existing.rows[0]) {
    const upd = await query(
      `UPDATE ts_employees SET
        user_id = COALESCE($1, user_id),
        employee_code = $2,
        full_name = $3,
        phone = $4,
        status = $5,
        updated_at = NOW()
       WHERE username = $6
       RETURNING *`,
      [userId, employeeCode, fullName, phone, status, username]
    );
    row = upd.rows[0];
    await logTimesheetAudit({
      username: user.username,
      role: user.role,
      action: "EMPLOYEE_UPDATE",
      entityType: "employee",
      entityId: row.id,
      after: JSON.stringify({ username, status }),
    });
  } else {
    const ins = await query(
      `INSERT INTO ts_employees (user_id, username, employee_code, full_name, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [userId, username, employeeCode, fullName, phone, status]
    );
    row = ins.rows[0];
    await logTimesheetAudit({
      username: user.username,
      role: user.role,
      action: "EMPLOYEE_CREATE",
      entityType: "employee",
      entityId: row.id,
      after: JSON.stringify({ username }),
    });
  }
  return { success: true, employee: mapEmployee(row) };
}

async function listProjects() {
  const r = await query(`SELECT * FROM ts_projects ORDER BY name`);
  return r.rows.map(mapProject);
}

async function upsertProject({ user, payload }) {
  const code = String(payload.code || "").trim().toUpperCase();
  const name = String(payload.name || code).trim();
  if (!code) return { error: "PROJECT_CODE_REQUIRED" };

  const fields = {
    description: String(payload.description || "").trim(),
    status: payload.status === "archived" ? "archived" : "active",
    geofence_lat: payload.lat != null ? Number(payload.lat) : payload.geofenceLat != null ? Number(payload.geofenceLat) : null,
    geofence_lng: payload.lng != null ? Number(payload.lng) : payload.geofenceLng != null ? Number(payload.geofenceLng) : null,
    geofence_radius_m: Math.max(10, Number(payload.radiusM || payload.geofenceRadiusM || 150) || 150),
    work_start_time: payload.workStart || payload.work_start_time || "08:00",
    work_end_time: payload.workEnd || payload.work_end_time || "17:00",
    late_grace_minutes: Math.max(0, Number(payload.lateGraceMinutes || 15) || 15),
  };

  const existing = await query(`SELECT * FROM ts_projects WHERE code = $1 LIMIT 1`, [code]);
  let row;
  if (existing.rows[0]) {
    const upd = await query(
      `UPDATE ts_projects SET
        name = $1, description = $2, status = $3,
        geofence_lat = $4, geofence_lng = $5, geofence_radius_m = $6,
        work_start_time = $7, work_end_time = $8, late_grace_minutes = $9,
        updated_at = NOW()
       WHERE code = $10
       RETURNING *`,
      [
        name,
        fields.description,
        fields.status,
        fields.geofence_lat,
        fields.geofence_lng,
        fields.geofence_radius_m,
        fields.work_start_time,
        fields.work_end_time,
        fields.late_grace_minutes,
        code,
      ]
    );
    row = upd.rows[0];
  } else {
    const secret = randomUUID().replace(/-/g, "").slice(0, 16);
    const ins = await query(
      `INSERT INTO ts_projects
        (code, name, description, status, geofence_lat, geofence_lng, geofence_radius_m,
         qr_secret, work_start_time, work_end_time, late_grace_minutes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        code,
        name,
        fields.description,
        fields.status,
        fields.geofence_lat,
        fields.geofence_lng,
        fields.geofence_radius_m,
        secret,
        fields.work_start_time,
        fields.work_end_time,
        fields.late_grace_minutes,
        user.username,
      ]
    );
    row = ins.rows[0];
  }

  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: existing.rows[0] ? "PROJECT_UPDATE" : "PROJECT_CREATE",
    entityType: "project",
    entityId: row.id,
    after: JSON.stringify({ code: row.code }),
  });

  return { success: true, project: mapProject(row) };
}

function projectQrPayload(project) {
  return {
    qrValue: `TS:${project.code}:${project.qr_secret}`,
    shortCode: project.code,
    display: `TS-${project.code}`,
  };
}

async function assignWorker({ user, projectId, employeeId }) {
  await query(
    `INSERT INTO ts_project_workers (project_id, employee_id, assigned_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (project_id, employee_id) DO NOTHING`,
    [projectId, employeeId, user.username]
  );
  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "ASSIGN_WORKER",
    entityType: "project",
    entityId: projectId,
    detail: String(employeeId),
  });
  return { success: true };
}

async function assignEngineer({ user, projectId, engineerUsername }) {
  const un = String(engineerUsername || "").trim();
  if (!un) return { error: "ENGINEER_USERNAME_REQUIRED" };
  await query(
    `INSERT INTO ts_project_engineers (project_id, username, assigned_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (project_id, username) DO NOTHING`,
    [projectId, un, user.username]
  );
  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "ASSIGN_ENGINEER",
    entityType: "project",
    entityId: projectId,
    detail: un,
  });
  return { success: true };
}

function mapEmployee(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    phone: row.phone,
    status: row.status,
    userRole: row.user_role,
  };
}

function mapProject(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    geofenceLat: row.geofence_lat,
    geofenceLng: row.geofence_lng,
    geofenceRadiusM: row.geofence_radius_m,
    workStart: row.work_start_time,
    workEnd: row.work_end_time,
    lateGraceMinutes: row.late_grace_minutes,
    qr: projectQrPayload(row),
  };
}

module.exports = {
  listEmployees,
  upsertEmployee,
  listProjects,
  upsertProject,
  projectQrPayload,
  assignWorker,
  assignEngineer,
  mapProject,
};
