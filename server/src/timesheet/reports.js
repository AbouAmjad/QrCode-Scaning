const { query } = require("../db");

async function reportDaily({ date, projectId, employeeId }) {
  const day = date || new Date().toISOString().slice(0, 10);
  let sql = `SELECT s.*, e.full_name, e.employee_code, p.code AS project_code, p.name AS project_name
             FROM ts_attendance_sessions s
             JOIN ts_employees e ON e.id = s.employee_id
             JOIN ts_projects p ON p.id = s.project_id
             WHERE s.check_in_at::date = $1::date`;
  const args = [day];
  if (projectId) {
    args.push(Number(projectId));
    sql += ` AND s.project_id = $${args.length}`;
  }
  if (employeeId) {
    args.push(Number(employeeId));
    sql += ` AND s.employee_id = $${args.length}`;
  }
  sql += ` ORDER BY s.check_in_at ASC`;
  const r = await query(sql, args);
  return {
    date: day,
    items: r.rows.map(mapReportRow),
    totals: aggregate(r.rows),
  };
}

async function reportMonthly({ month, projectId }) {
  const m = month || new Date().toISOString().slice(0, 7);
  let sql = `SELECT
      e.id AS employee_id,
      e.full_name,
      e.employee_code,
      COUNT(*) FILTER (WHERE s.check_in_at IS NOT NULL) AS sessions,
      COALESCE(SUM(s.worked_minutes),0) AS worked_minutes,
      COALESCE(SUM(s.overtime_minutes),0) AS overtime_minutes,
      COALESCE(SUM(s.deduction_minutes),0) AS session_deductions
     FROM ts_attendance_sessions s
     JOIN ts_employees e ON e.id = s.employee_id
     WHERE s.check_in_at >= $1::date
       AND s.check_in_at < ($1::date + INTERVAL '1 month')`;
  const args = [`${m}-01`];
  if (projectId) {
    args.push(Number(projectId));
    sql += ` AND s.project_id = $${args.length}`;
  }
  sql += ` GROUP BY e.id, e.full_name, e.employee_code ORDER BY e.full_name`;
  const r = await query(sql, args);

  const items = [];
  for (const row of r.rows) {
    const ded = await query(
      `SELECT COALESCE(SUM(minutes_deducted),0) AS total FROM ts_deductions
       WHERE employee_id = $1 AND created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 month')`,
      [row.employee_id, `${m}-01`]
    );
    const deductionMinutes =
      Number(row.session_deductions) + Number(ded.rows[0]?.total || 0);
    items.push({
      employeeId: row.employee_id,
      fullName: row.full_name,
      employeeCode: row.employee_code,
      sessions: Number(row.sessions) || 0,
      workedMinutes: Number(row.worked_minutes) || 0,
      workedHours: roundHours(row.worked_minutes),
      overtimeMinutes: Number(row.overtime_minutes) || 0,
      overtimeHours: roundHours(row.overtime_minutes),
      deductionMinutes,
      deductionHours: roundHours(deductionMinutes),
    });
  }

  return { month: m, items, totals: aggregateMonthly(items) };
}

async function reportSummary({ from, to, projectId }) {
  let sql = `SELECT
      COUNT(*) AS sessions,
      COUNT(*) FILTER (WHERE status = 'review' OR review_required = TRUE) AS review_count,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
      COALESCE(SUM(worked_minutes),0) AS worked_minutes,
      COALESCE(SUM(overtime_minutes),0) AS overtime_minutes
     FROM ts_attendance_sessions WHERE 1=1`;
  const args = [];
  if (from) {
    args.push(from);
    sql += ` AND check_in_at >= $${args.length}::date`;
  }
  if (to) {
    args.push(to);
    sql += ` AND check_in_at <= ($${args.length}::date + INTERVAL '1 day')`;
  }
  if (projectId) {
    args.push(Number(projectId));
    sql += ` AND project_id = $${args.length}`;
  }
  const r = await query(sql, args);
  const row = r.rows[0] || {};
  return {
    sessions: Number(row.sessions) || 0,
    reviewCount: Number(row.review_count) || 0,
    rejectedCount: Number(row.rejected_count) || 0,
    workedMinutes: Number(row.worked_minutes) || 0,
    overtimeMinutes: Number(row.overtime_minutes) || 0,
  };
}

function mapReportRow(row) {
  return {
    sessionId: row.id,
    employeeCode: row.employee_code,
    employeeName: row.full_name,
    projectCode: row.project_code,
    projectName: row.project_name,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    workedMinutes: row.worked_minutes,
    overtimeMinutes: row.overtime_minutes,
    deductionMinutes: row.deduction_minutes,
    status: row.status,
    late: isLate(row),
    absent: false,
  };
}

function isLate(row) {
  if (!row.check_in_at) return false;
  return false;
}

function aggregate(rows) {
  return {
    sessions: rows.length,
    workedMinutes: rows.reduce((s, r) => s + Number(r.worked_minutes || 0), 0),
    overtimeMinutes: rows.reduce((s, r) => s + Number(r.overtime_minutes || 0), 0),
  };
}

function aggregateMonthly(items) {
  return {
    employees: items.length,
    workedMinutes: items.reduce((s, i) => s + i.workedMinutes, 0),
    overtimeMinutes: items.reduce((s, i) => s + i.overtimeMinutes, 0),
    deductionMinutes: items.reduce((s, i) => s + i.deductionMinutes, 0),
  };
}

function roundHours(minutes) {
  return Math.round((Number(minutes) / 60) * 100) / 100;
}

module.exports = { reportDaily, reportMonthly, reportSummary };
