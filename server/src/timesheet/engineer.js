const { query } = require("../db");
const { logTimesheetAudit } = require("./audit");
const { SESSION_STATUS } = require("./constants");
const { mapSession } = require("./sessions");

async function engineerWorkerIds(username) {
  const r = await query(
    `SELECT pw.employee_id
     FROM ts_project_engineers pe
     JOIN ts_project_workers pw ON pw.project_id = pe.project_id
     WHERE pe.username = $1`,
    [username]
  );
  return [...new Set(r.rows.map((x) => x.employee_id))];
}

async function listEngineerWorkers(username) {
  const ids = await engineerWorkerIds(username);
  if (!ids.length) return [];
  const r = await query(
    `SELECT e.* FROM ts_employees e WHERE e.id = ANY($1::int[]) ORDER BY e.full_name`,
    [ids]
  );
  return r.rows.map((row) => ({
    id: row.id,
    username: row.username,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    status: row.status,
  }));
}

async function listEngineerSessions(username, { limit = 100, projectId } = {}) {
  const projects = await query(
    `SELECT project_id FROM ts_project_engineers WHERE username = $1`,
    [username]
  );
  const projectIds = projects.rows.map((x) => x.project_id);
  if (!projectIds.length) return [];

  let sql = `SELECT s.*, p.code AS project_code, p.name AS project_name, e.full_name, e.username AS employee_username
             FROM ts_attendance_sessions s
             JOIN ts_projects p ON p.id = s.project_id
             JOIN ts_employees e ON e.id = s.employee_id
             WHERE s.project_id = ANY($1::int[])`;
  const args = [projectIds];
  if (projectId) {
    args.push(Number(projectId));
    sql += ` AND s.project_id = $${args.length}`;
  }
  args.push(limit);
  sql += ` ORDER BY s.check_in_at DESC NULLS LAST LIMIT $${args.length}`;
  const r = await query(sql, args);
  return r.rows.map((row) => ({
    ...mapSession(row, { code: row.project_code, name: row.project_name }),
    employeeName: row.full_name,
    employeeUsername: row.employee_username,
  }));
}

async function createDeduction({ user, employeeId, projectId, sessionId, minutes, reason }) {
  const mins = Math.max(1, Number(minutes) || 0);
  const why = String(reason || "").trim();
  if (!mins) return { error: "MINUTES_REQUIRED" };
  if (!why) return { error: "REASON_REQUIRED" };

  const allowed = await canEngineerManageEmployee(user.username, employeeId, projectId);
  if (!allowed) return { error: "FORBIDDEN" };

  const ins = await query(
    `INSERT INTO ts_deductions (session_id, employee_id, project_id, minutes_deducted, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [sessionId || null, employeeId, projectId || null, mins, why, user.username]
  );

  if (sessionId) {
    await query(
      `UPDATE ts_attendance_sessions SET deduction_minutes = deduction_minutes + $1, updated_at = NOW()
       WHERE id = $2`,
      [mins, sessionId]
    );
  }

  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "DEDUCTION_CREATE",
    entityType: "employee",
    entityId: employeeId,
    after: JSON.stringify({ minutes: mins, reason: why }),
  });

  return { success: true, deduction: mapDeduction(ins.rows[0]) };
}

async function canEngineerManageEmployee(engineerUsername, employeeId, projectId) {
  if (!projectId) {
    const r = await query(
      `SELECT 1 FROM ts_project_engineers pe
       JOIN ts_project_workers pw ON pw.project_id = pe.project_id
       WHERE pe.username = $1 AND pw.employee_id = $2 LIMIT 1`,
      [engineerUsername, employeeId]
    );
    return !!r.rows.length;
  }
  const r = await query(
    `SELECT 1 FROM ts_project_engineers pe
     JOIN ts_project_workers pw ON pw.project_id = pe.project_id
     WHERE pe.username = $1 AND pe.project_id = $2 AND pw.employee_id = $3 LIMIT 1`,
    [engineerUsername, projectId, employeeId]
  );
  return !!r.rows.length;
}

async function reviewSession({ user, sessionId, status, notes }) {
  const allowed = ["completed", "rejected", "review", "flagged"];
  const next = allowed.includes(status) ? status : SESSION_STATUS.COMPLETED;
  const r = await query(`SELECT * FROM ts_attendance_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
  const session = r.rows[0];
  if (!session) return { error: "SESSION_NOT_FOUND" };

  const upd = await query(
    `UPDATE ts_attendance_sessions SET
      status = $1,
      engineer_notes = COALESCE($2, engineer_notes),
      reviewed_by = $3,
      reviewed_at = NOW(),
      updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [next, String(notes || "").trim(), user.username, sessionId]
  );

  await logTimesheetAudit({
    username: user.username,
    role: user.role,
    action: "SESSION_REVIEW",
    entityType: "session",
    entityId: sessionId,
    before: session.status,
    after: next,
    detail: notes || "",
  });

  return { success: true, session: upd.rows[0] };
}

function mapDeduction(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    employeeId: row.employee_id,
    projectId: row.project_id,
    minutes: row.minutes_deducted,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

module.exports = {
  listEngineerWorkers,
  listEngineerSessions,
  createDeduction,
  reviewSession,
  canEngineerManageEmployee,
};
