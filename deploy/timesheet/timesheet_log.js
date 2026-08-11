/**
 * Timesheet activity / notification helpers — additive only.
 */
const U = require("../lib/util");

function refCode(prefix, id) {
  const n = Number(id) || 0;
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

async function workerDayNet(query, workerCode, workDate) {
  const code = U.upper(workerCode);
  const att = await query(
    `SELECT COALESCE(SUM(base_hours),0) AS base
       FROM timesheet_attendance
      WHERE worker_code = $1 AND work_date = $2 AND status = 'active'`,
    [code, workDate]
  );
  const adj = await query(
    `SELECT COALESCE(SUM(l.delta_hours),0) AS delta
       FROM timesheet_hour_adjustment_lines l
       JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
      WHERE l.worker_code = $1 AND h.work_date = $2 AND h.status = 'active'`,
    [code, workDate]
  );
  const base = Number(att.rows[0]?.base || 0);
  const delta = Number(adj.rows[0]?.delta || 0);
  return { baseHours: base, adjustmentHours: delta, netHours: Math.max(0, base + delta) };
}

async function writeActivity(query, row) {
  const r = await query(
    `INSERT INTO timesheet_activity_log
       (ref_code, event_type, worker_code, work_date, project_id,
        before_value, after_value, delta_value, unit, reason, meta, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
     RETURNING id, created_at`,
    [
      row.refCode,
      row.eventType,
      row.workerCode || null,
      row.workDate || null,
      row.projectId || null,
      row.beforeValue != null ? row.beforeValue : null,
      row.afterValue != null ? row.afterValue : null,
      row.deltaValue != null ? row.deltaValue : null,
      row.unit || "hours",
      row.reason || "",
      JSON.stringify(row.meta || {}),
      row.createdByUserId || null,
    ]
  );
  return { id: Number(r.rows[0].id), createdAt: r.rows[0].created_at };
}

async function writeNotification(query, row) {
  await query(
    `INSERT INTO timesheet_notifications
       (kind, title, body, ref_code, severity, target_role, target_user_id, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      row.kind,
      row.title,
      row.body || "",
      row.refCode || "",
      row.severity || "info",
      row.targetRole || null,
      row.targetUserId || null,
      JSON.stringify(row.meta || {}),
    ]
  );
}

async function notifyHourChange(query, { refCode: ref, workerCode, workDate, before, after, delta, byUser, reason }) {
  await writeNotification(query, {
    kind: "hours_adjusted",
    title: `Hours adjusted · ${workerCode}`,
    body: `${workDate}: ${before}h → ${after}h (${delta > 0 ? "+" : ""}${delta}h). ${reason || ""}`.trim(),
    refCode: ref,
    severity: "info",
    meta: { workerCode, workDate, before, after, delta, byUser },
  });
  if (after >= 14 || Math.abs(delta) >= 8) {
    await writeNotification(query, {
      kind: "abnormal_hours",
      title: `Unusual hours · ${workerCode}`,
      body: `${workDate}: net ${after}h (change ${delta > 0 ? "+" : ""}${delta}h). Please review.`,
      refCode: ref,
      severity: "warning",
      meta: { workerCode, workDate, after, delta },
    });
  }
}

module.exports = {
  refCode,
  workerDayNet,
  writeActivity,
  writeNotification,
  notifyHourChange,
};
