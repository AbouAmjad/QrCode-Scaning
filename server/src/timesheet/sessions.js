const { query } = require("../db");
const { insideGeofence } = require("./geo");
const { logTimesheetAudit } = require("./audit");
const { SESSION_STATUS } = require("./constants");

async function getEmployeeByUsername(username) {
  const r = await query(
    `SELECT e.*, u.role AS user_role
     FROM ts_employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.username = $1 AND e.status = 'active'
     LIMIT 1`,
    [username]
  );
  return r.rows[0] || null;
}

async function getEmployeeById(id) {
  const r = await query(`SELECT * FROM ts_employees WHERE id = $1 LIMIT 1`, [id]);
  return r.rows[0] || null;
}

async function workerProjects(employeeId) {
  const r = await query(
    `SELECT p.*
     FROM ts_projects p
     JOIN ts_project_workers pw ON pw.project_id = p.id
     WHERE pw.employee_id = $1 AND p.status = 'active'
     ORDER BY p.name`,
    [employeeId]
  );
  return r.rows;
}

async function engineerProjects(username) {
  const r = await query(
    `SELECT p.*
     FROM ts_projects p
     JOIN ts_project_engineers pe ON pe.project_id = p.id
     WHERE pe.username = $1 AND p.status = 'active'
     ORDER BY p.name`,
    [username]
  );
  return r.rows;
}

async function validateProjectAccess(employeeId, projectId) {
  const r = await query(
    `SELECT 1 FROM ts_project_workers WHERE employee_id = $1 AND project_id = $2 LIMIT 1`,
    [employeeId, projectId]
  );
  return !!r.rows.length;
}

async function getOpenSession(employeeId) {
  const r = await query(
    `SELECT s.*, p.code AS project_code, p.name AS project_name
     FROM ts_attendance_sessions s
     JOIN ts_projects p ON p.id = s.project_id
     WHERE s.employee_id = $1 AND s.status = $2
     ORDER BY s.id DESC LIMIT 1`,
    [employeeId, SESSION_STATUS.OPEN]
  );
  return r.rows[0] || null;
}

function validateQr(project, qrScanned) {
  const scanned = String(qrScanned || "").trim();
  if (!scanned) return { ok: false, reason: "QR_REQUIRED" };
  const expected = `TS:${project.code}:${project.qr_secret}`;
  const alt = project.code;
  if (scanned === expected || scanned === alt || scanned === `TS-${project.code}`) {
    return { ok: true };
  }
  return { ok: false, reason: "QR_INVALID" };
}

async function checkIn({ user, employee, projectId, lat, lng, accuracyM, qrCode, device = "" }) {
  const open = await getOpenSession(employee.id);
  if (open) return { error: "OPEN_SESSION_EXISTS", session: open };

  const pr = await query(`SELECT * FROM ts_projects WHERE id = $1 AND status = 'active' LIMIT 1`, [
    projectId,
  ]);
  const project = pr.rows[0];
  if (!project) return { error: "PROJECT_NOT_FOUND" };

  const assigned = await validateProjectAccess(employee.id, project.id);
  if (!assigned) return { error: "NOT_ASSIGNED_TO_PROJECT" };

  const qr = validateQr(project, qrCode);
  if (!qr.ok) {
    await logTimesheetAudit({
      username: user.username,
      role: user.role,
      action: "CHECK_IN_REJECTED",
      entityType: "project",
      entityId: project.id,
      detail: qr.reason,
      device,
    });
    return { error: qr.reason };
  }

  const geo = insideGeofence(lat, lng, project.geofence_lat, project.geofence_lng, project.geofence_radius_m);
  if (!geo.ok && !geo.skipped) {
    await logTimesheetAudit({
      username: user.username,
      role: user.role,
      action: "CHECK_IN_REJECTED",
      entityType: "project",
      entityId: project.id,
      detail: geo.reason,
      device,
    });
    return { error: geo.reason, distanceM: geo.distanceM };
  }

  const now = new Date();
  let status = SESSION_STATUS.OPEN;
  let reviewRequired = false;
  if (geo.skipped) {
    reviewRequired = true;
    status = SESSION_STATUS.REVIEW;
  }

  const ins = await query(
    `INSERT INTO ts_attendance_sessions
      (employee_id, project_id, check_in_at, check_in_lat, check_in_lng, check_in_accuracy_m,
       qr_validated, qr_code_scanned, status, review_required, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$10)
     RETURNING *`,
    [
      employee.id,
      project.id,
      now,
      lat ?? null,
      lng ?? null,
      accuracyM ?? null,
      String(qrCode || "").trim(),
      status,
      reviewRequired,
      user.username,
    ]
  );

  const session = ins.rows[0];
  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "CHECK_IN",
    entityType: "session",
    entityId: session.id,
    after: JSON.stringify({ projectId: project.id, status }),
    device,
  });

  return {
    success: true,
    session: mapSession(session, project),
    reviewRequired,
    geoSkipped: geo.skipped,
  };
}

async function checkOut({ user, employee, lat, lng, accuracyM, device = "" }) {
  const open = await getOpenSession(employee.id);
  if (!open) return { error: "NO_OPEN_SESSION" };

  const pr = await query(`SELECT * FROM ts_projects WHERE id = $1 LIMIT 1`, [open.project_id]);
  const project = pr.rows[0];

  const geo = insideGeofence(
    lat,
    lng,
    project?.geofence_lat,
    project?.geofence_lng,
    project?.geofence_radius_m
  );
  if (!geo.ok && !geo.skipped) {
    return { error: geo.reason, distanceM: geo.distanceM };
  }

  const now = new Date();
  const checkIn = new Date(open.check_in_at);
  const workedMinutes = Math.max(0, Math.round((now - checkIn) / 60000));

  let overtimeMinutes = 0;
  if (project?.work_end_time) {
    const [eh, em] = String(project.work_end_time).split(":").map(Number);
    const end = new Date(checkIn);
    end.setHours(eh || 17, em || 0, 0, 0);
    if (now > end) overtimeMinutes = Math.round((now - end) / 60000);
  }

  let status = SESSION_STATUS.COMPLETED;
  let reviewRequired = open.review_required;
  if (geo.skipped) reviewRequired = true;
  if (reviewRequired) status = SESSION_STATUS.REVIEW;

  const upd = await query(
    `UPDATE ts_attendance_sessions SET
      check_out_at = $1,
      check_out_lat = $2,
      check_out_lng = $3,
      check_out_accuracy_m = $4,
      worked_minutes = $5,
      overtime_minutes = $6,
      status = $7,
      review_required = $8,
      updated_by = $9,
      updated_at = NOW()
     WHERE id = $10
     RETURNING *`,
    [
      now,
      lat ?? null,
      lng ?? null,
      accuracyM ?? null,
      workedMinutes,
      overtimeMinutes,
      status,
      reviewRequired,
      user.username,
      open.id,
    ]
  );

  const session = upd.rows[0];
  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "CHECK_OUT",
    entityType: "session",
    entityId: session.id,
    after: JSON.stringify({ workedMinutes, overtimeMinutes, status }),
    device,
  });

  return { success: true, session: mapSession(session, project) };
}

function mapSession(row, project) {
  return {
    id: row.public_id || row.id,
    sessionId: row.id,
    employeeId: row.employee_id,
    projectId: row.project_id,
    projectCode: project?.code || row.project_code,
    projectName: project?.name || row.project_name,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    checkInLat: row.check_in_lat,
    checkInLng: row.check_in_lng,
    checkOutLat: row.check_out_lat,
    checkOutLng: row.check_out_lng,
    qrValidated: row.qr_validated,
    status: row.status,
    workedMinutes: row.worked_minutes,
    overtimeMinutes: row.overtime_minutes,
    deductionMinutes: row.deduction_minutes,
    reviewRequired: row.review_required,
    rejectionReason: row.rejection_reason,
    engineerNotes: row.engineer_notes,
    faceMatchScoreIn: row.face_match_score_in,
    livenessScoreIn: row.liveness_score_in,
  };
}

async function listEmployeeSessions(employeeId, { limit = 60, from, to } = {}) {
  let sql = `SELECT s.*, p.code AS project_code, p.name AS project_name
             FROM ts_attendance_sessions s
             JOIN ts_projects p ON p.id = s.project_id
             WHERE s.employee_id = $1`;
  const args = [employeeId];
  if (from) {
    args.push(from);
    sql += ` AND s.check_in_at >= $${args.length}`;
  }
  if (to) {
    args.push(to);
    sql += ` AND s.check_in_at <= $${args.length}`;
  }
  args.push(limit);
  sql += ` ORDER BY s.check_in_at DESC NULLS LAST LIMIT $${args.length}`;
  const r = await query(sql, args);
  return r.rows.map((row) => mapSession(row, { code: row.project_code, name: row.project_name }));
}

async function employeeSummary(employeeId, month) {
  const start = month ? `${month}-01` : null;
  let sql = `SELECT
      COUNT(*) FILTER (WHERE check_in_at IS NOT NULL) AS sessions,
      COALESCE(SUM(worked_minutes),0) AS worked_minutes,
      COALESCE(SUM(overtime_minutes),0) AS overtime_minutes,
      COALESCE(SUM(deduction_minutes),0) AS session_deductions
     FROM ts_attendance_sessions
     WHERE employee_id = $1`;
  const args = [employeeId];
  if (start) {
    args.push(start);
    sql += ` AND check_in_at >= $2::date AND check_in_at < ($2::date + INTERVAL '1 month')`;
  }
  const r = await query(sql, args);
  const row = r.rows[0] || {};
  const ded = await query(
    `SELECT COALESCE(SUM(minutes_deducted),0) AS total
     FROM ts_deductions WHERE employee_id = $1` +
      (start ? ` AND created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 month')` : ""),
    start ? [employeeId, start] : [employeeId]
  );
  return {
    sessions: Number(row.sessions) || 0,
    workedMinutes: Number(row.worked_minutes) || 0,
    workedHours: roundHours(row.worked_minutes),
    overtimeMinutes: Number(row.overtime_minutes) || 0,
    overtimeHours: roundHours(row.overtime_minutes),
    deductionMinutes:
      Number(row.session_deductions || 0) + Number(ded.rows[0]?.total || 0),
    deductionHours: roundHours(
      Number(row.session_deductions || 0) + Number(ded.rows[0]?.total || 0)
    ),
  };
}

function roundHours(minutes) {
  return Math.round((Number(minutes) / 60) * 100) / 100;
}

module.exports = {
  getEmployeeByUsername,
  getEmployeeById,
  workerProjects,
  engineerProjects,
  getOpenSession,
  checkIn,
  checkOut,
  listEmployeeSessions,
  employeeSummary,
  mapSession,
};
