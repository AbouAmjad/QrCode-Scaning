/**
 * Additive timesheet feature endpoints (stats, charts, reports, activity, notifications).
 * Does not replace existing timesheet handlers.
 */
const U = require("../lib/util");
const { fail } = require("../lib/ctx");
const log = require("./timesheet_log");

function asDateOnly(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(v, fallback) {
  const s = U.trimmed(v);
  if (!s) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail("VALIDATION", { field: "date", value: s });
  return s;
}

function requireTimesheetRead(ctx) {
  ctx.requireAny([
    "timesheet.attendance.read",
    "timesheet.reports.read",
    "timesheet.hours.adjust",
    "timesheet.deductions.manage",
    "timesheet.attendance.void",
    "timesheet.settings.manage",
  ]);
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

async function timesheetDashboardStats(ctx) {
  requireTimesheetRead(ctx);
  const day = parseDate(ctx.params.date, todayLocalDate());

  const present = await ctx.query(
    `SELECT COUNT(*)::int AS n,
            COALESCE(SUM(base_hours),0) AS base_hours,
            COUNT(DISTINCT project_id)::int AS projects
       FROM timesheet_attendance
      WHERE work_date = $1 AND status = 'active'`,
    [day]
  );
  const adj = await ctx.query(
    `SELECT COALESCE(SUM(l.delta_hours),0) AS delta
       FROM timesheet_hour_adjustment_lines l
       JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
      WHERE h.work_date = $1 AND h.status = 'active'`,
    [day]
  );
  const presentCodes = await ctx.query(
    `SELECT DISTINCT worker_code FROM timesheet_attendance
      WHERE work_date = $1 AND status = 'active'`,
    [day]
  );
  const presentSet = new Set(presentCodes.rows.map((r) => r.worker_code));

  // Workforce pool: people who punched in last 60 days
  const pool = await ctx.query(
    `SELECT DISTINCT worker_code
       FROM timesheet_attendance
      WHERE status = 'active' AND work_date >= ($1::date - INTERVAL '60 days')`,
    [day]
  );
  const absent = pool.rows.filter((r) => !presentSet.has(r.worker_code)).length;
  const base = Number(present.rows[0].base_hours);
  const delta = Number(adj.rows[0].delta);
  const modified = await ctx.query(
    `SELECT COUNT(DISTINCT a.worker_code)::int AS n
       FROM timesheet_attendance a
      WHERE a.work_date = $1 AND a.status = 'active'
        AND EXISTS (
          SELECT 1 FROM timesheet_hour_adjustment_lines l
          JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
          WHERE l.worker_code = a.worker_code AND h.work_date = a.work_date AND h.status = 'active'
        )`,
    [day]
  );

  return {
    date: day,
    present: present.rows[0].n,
    absent,
    modified: modified.rows[0].n,
    netHours: Math.max(0, base + delta),
    baseHours: base,
    adjustmentHours: delta,
    activeProjects: present.rows[0].projects,
    workforcePool: pool.rows.length,
  };
}

async function timesheetChartSeries(ctx) {
  requireTimesheetRead(ctx);
  const mode = U.trimmed(ctx.params.mode || "week").toLowerCase(); // week | month
  const end = parseDate(ctx.params.to, todayLocalDate());
  const days = mode === "month" ? 30 : 7;
  const start = parseDate(ctx.params.from, addDays(end, -(days - 1)));

  const att = await ctx.query(
    `SELECT work_date,
            COUNT(*)::int AS present,
            COALESCE(SUM(base_hours),0) AS base_hours,
            COUNT(DISTINCT project_id)::int AS projects
       FROM timesheet_attendance
      WHERE status = 'active' AND work_date >= $1 AND work_date <= $2
      GROUP BY work_date
      ORDER BY work_date`,
    [start, end]
  );
  const adj = await ctx.query(
    `SELECT h.work_date, COALESCE(SUM(l.delta_hours),0) AS delta
       FROM timesheet_hour_adjustments h
       JOIN timesheet_hour_adjustment_lines l ON l.adjustment_id = h.id
      WHERE h.status = 'active' AND h.work_date >= $1 AND h.work_date <= $2
      GROUP BY h.work_date`,
    [start, end]
  );
  const adjMap = new Map(adj.rows.map((r) => [asDateOnly(r.work_date), Number(r.delta)]));
  const attMap = new Map(
    att.rows.map((r) => [
      asDateOnly(r.work_date),
      {
        present: r.present,
        baseHours: Number(r.base_hours),
        projects: r.projects,
      },
    ])
  );

  const points = [];
  let cur = start;
  while (cur <= end) {
    const a = attMap.get(cur) || { present: 0, baseHours: 0, projects: 0 };
    const dlt = adjMap.get(cur) || 0;
    points.push({
      date: cur,
      present: a.present,
      projects: a.projects,
      netHours: Math.max(0, a.baseHours + dlt),
      adjustmentHours: dlt,
    });
    cur = addDays(cur, 1);
  }
  return { from: start, to: end, mode, points };
}

async function timesheetProjectSummary(ctx) {
  requireTimesheetRead(ctx);
  const from = parseDate(ctx.params.from, addDays(todayLocalDate(), -6));
  const to = parseDate(ctx.params.to, todayLocalDate());
  const r = await ctx.query(
    `SELECT p.id AS project_id, p.code AS project_code, p.name AS project_name,
            COUNT(*)::int AS punches,
            COUNT(DISTINCT a.worker_code)::int AS workers,
            COALESCE(SUM(a.base_hours),0) AS base_hours
       FROM timesheet_attendance a
       JOIN projects p ON p.id = a.project_id
      WHERE a.status = 'active' AND a.work_date >= $1 AND a.work_date <= $2
      GROUP BY p.id, p.code, p.name
      ORDER BY base_hours DESC, p.name`,
    [from, to]
  );
  const rows = [];
  for (const row of r.rows) {
    const workers = await ctx.query(
      `SELECT DISTINCT a.worker_code, tw.name AS worker_name
         FROM timesheet_attendance a
         JOIN timesheet_workers tw ON tw.code = a.worker_code
        WHERE a.status = 'active' AND a.project_id = $1
          AND a.work_date >= $2 AND a.work_date <= $3
        ORDER BY a.worker_code`,
      [row.project_id, from, to]
    );
    rows.push({
      projectId: row.project_id,
      projectCode: row.project_code,
      projectName: row.project_name,
      punches: row.punches,
      workers: row.workers,
      baseHours: Number(row.base_hours),
      workerList: workers.rows.map((w) => ({
        workerCode: w.worker_code,
        workerName: w.worker_name,
      })),
    });
  }
  return { from, to, rows };
}

async function timesheetReportSummary(ctx) {
  requireTimesheetRead(ctx);
  const from = parseDate(ctx.params.from, addDays(todayLocalDate(), -6));
  const to = parseDate(ctx.params.to, todayLocalDate());
  const groupBy = U.trimmed(ctx.params.groupBy || "worker").toLowerCase(); // worker | project | day

  if (groupBy === "day") {
    const chart = await timesheetChartSeries(ctx);
    return {
      from,
      to,
      groupBy: "day",
      rows: chart.points.map((p) => ({
        key: p.date,
        label: p.date,
        present: p.present,
        netHours: p.netHours,
        adjustmentHours: p.adjustmentHours,
        projects: p.projects,
      })),
    };
  }

  if (groupBy === "project") {
    const sum = await timesheetProjectSummary(ctx);
    return {
      from,
      to,
      groupBy: "project",
      rows: sum.rows.map((r) => ({
        key: String(r.projectId),
        label: r.projectName,
        workers: r.workers,
        punches: r.punches,
        baseHours: r.baseHours,
        workerList: r.workerList,
      })),
    };
  }

  // worker
  const att = await ctx.query(
    `SELECT a.worker_code, tw.name AS worker_name,
            COUNT(*)::int AS days,
            COALESCE(SUM(a.base_hours),0) AS base_hours
       FROM timesheet_attendance a
       JOIN timesheet_workers tw ON tw.code = a.worker_code
      WHERE a.status = 'active' AND a.work_date >= $1 AND a.work_date <= $2
      GROUP BY a.worker_code, tw.name
      ORDER BY a.worker_code`,
    [from, to]
  );
  const adj = await ctx.query(
    `SELECT l.worker_code, COALESCE(SUM(l.delta_hours),0) AS delta
       FROM timesheet_hour_adjustment_lines l
       JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
      WHERE h.status = 'active' AND h.work_date >= $1 AND h.work_date <= $2
      GROUP BY l.worker_code`,
    [from, to]
  );
  const ded = await ctx.query(
    `SELECT worker_code, COALESCE(SUM(amount),0) AS amount
       FROM timesheet_deductions
      WHERE status = 'active' AND work_date >= $1 AND work_date <= $2
      GROUP BY worker_code`,
    [from, to]
  );
  const adjMap = new Map(adj.rows.map((r) => [r.worker_code, Number(r.delta)]));
  const dedMap = new Map(ded.rows.map((r) => [r.worker_code, Number(r.amount)]));
  return {
    from,
    to,
    groupBy: "worker",
    rows: att.rows.map((r) => {
      const dlt = adjMap.get(r.worker_code) || 0;
      return {
        key: r.worker_code,
        label: `${r.worker_code} · ${r.worker_name || ""}`,
        workerCode: r.worker_code,
        workerName: r.worker_name,
        days: r.days,
        baseHours: Number(r.base_hours),
        adjustmentHours: dlt,
        netHours: Math.max(0, Number(r.base_hours) + dlt),
        deductions: dedMap.get(r.worker_code) || 0,
      };
    }),
  };
}

async function timesheetActivityList(ctx) {
  requireTimesheetRead(ctx);
  const from = parseDate(ctx.params.from, null);
  const to = parseDate(ctx.params.to, null);
  const workerCode = U.upper(ctx.params.workerCode || "");
  const eventType = U.trimmed(ctx.params.eventType || "");
  const where = ["1=1"];
  const args = [];
  if (from) {
    args.push(from);
    where.push(`a.created_at::date >= $${args.length}`);
  }
  if (to) {
    args.push(to);
    where.push(`a.created_at::date <= $${args.length}`);
  }
  if (workerCode) {
    args.push(workerCode);
    where.push(`a.worker_code = $${args.length}`);
  }
  if (eventType) {
    args.push(eventType);
    where.push(`a.event_type = $${args.length}`);
  }
  const r = await ctx.query(
    `SELECT a.*, u.username AS created_by
       FROM timesheet_activity_log a
       LEFT JOIN users u ON u.id = a.created_by_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 500`,
    args
  );
  return {
    rows: r.rows.map((row) => ({
      id: Number(row.id),
      refCode: row.ref_code,
      eventType: row.event_type,
      workerCode: row.worker_code,
      workDate: asDateOnly(row.work_date),
      projectId: row.project_id,
      beforeValue: row.before_value != null ? Number(row.before_value) : null,
      afterValue: row.after_value != null ? Number(row.after_value) : null,
      deltaValue: row.delta_value != null ? Number(row.delta_value) : null,
      unit: row.unit,
      reason: row.reason || "",
      meta: row.meta || {},
      createdBy: row.created_by || "",
      createdAt: U.isoOrNull(row.created_at),
    })),
  };
}

async function timesheetNotificationsList(ctx) {
  ctx.requireAny([
    "timesheet.notifications.read",
    "timesheet.attendance.read",
    "timesheet.hours.adjust",
    "timesheet.deductions.manage",
  ]);
  const unreadOnly = String(ctx.params.unreadOnly || "") === "1" || ctx.params.unreadOnly === true;
  const where = ["1=1"];
  const args = [];
  if (unreadOnly) where.push(`is_read = FALSE`);
  // visible to all timesheet readers (broadcast), or targeted
  args.push(ctx.user.id);
  where.push(`(target_user_id IS NULL OR target_user_id = $${args.length})`);
  const r = await ctx.query(
    `SELECT * FROM timesheet_notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    args
  );
  return {
    rows: r.rows.map((row) => ({
      id: Number(row.id),
      kind: row.kind,
      title: row.title,
      body: row.body,
      refCode: row.ref_code,
      severity: row.severity,
      isRead: !!row.is_read,
      createdAt: U.isoOrNull(row.created_at),
      meta: row.meta || {},
    })),
    unread: r.rows.filter((x) => !x.is_read).length,
  };
}

async function timesheetNotificationsMarkRead(ctx) {
  ctx.requireAny([
    "timesheet.notifications.read",
    "timesheet.attendance.read",
    "timesheet.hours.adjust",
  ]);
  const id = U.int(ctx.params.id, 0);
  if (id) {
    await ctx.query(`UPDATE timesheet_notifications SET is_read = TRUE WHERE id = $1`, [id]);
  } else {
    await ctx.query(
      `UPDATE timesheet_notifications SET is_read = TRUE
        WHERE is_read = FALSE AND (target_user_id IS NULL OR target_user_id = $1)`,
      [ctx.user.id]
    );
  }
  return { ok: true };
}

module.exports = {
  timesheetDashboardStats,
  timesheetChartSeries,
  timesheetProjectSummary,
  timesheetReportSummary,
  timesheetActivityList,
  timesheetNotificationsList,
  timesheetNotificationsMarkRead,
  // re-export helpers for mutation hooks
  log,
};
