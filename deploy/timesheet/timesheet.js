/**
 * Timesheet handlers — additive module (attendance, hours, deductions, portal).
 * Does not write custody ledgers (scans / stock).
 */
const U = require("../lib/util");
const custody = require("../custody");
const { fail } = require("../lib/ctx");

const DED_TYPES = new Set(["delay", "absence", "tool_damage", "fixed_amount"]);

/** pg DATE often becomes a JS Date at midnight UTC — keep calendar YYYY-MM-DD. */
function asDateOnly(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // node-pg gives DATE as local-midnight Date; use local Y/M/D (not UTC).
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function todayLocalDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(v, fallback) {
  const s = U.trimmed(v);
  if (!s) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail("VALIDATION", { field: "date", value: s });
  return s;
}

function monthRange(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

async function requirePerson(query, code) {
  const c = U.upper(code);
  if (!c) fail("VALIDATION", { field: "workerCode" });
  const r = await query(
    `SELECT code, description, kind FROM catalog WHERE code = $1 LIMIT 1`,
    [c]
  );
  const row = r.rows[0];
  if (!row) fail("WORKER_NOT_FOUND", { workerCode: c });
  if (String(row.kind).toLowerCase() !== "person") fail("WORKER_NOT_FOUND", { workerCode: c, reason: "not_person" });
  return { code: U.upper(row.code), name: row.description || row.code };
}

async function requireProject(query, projectId) {
  const id = U.int(projectId, 0);
  if (!id) fail("VALIDATION", { field: "projectId" });
  const r = await query(`SELECT id, code, name, status FROM projects WHERE id = $1 LIMIT 1`, [id]);
  const row = r.rows[0];
  if (!row) fail("PROJECT_NOT_FOUND", { projectId: id });
  return row;
}

async function getShiftHours(query) {
  const r = await query(`SELECT default_shift_hours FROM timesheet_settings WHERE id = 1`);
  const h = r.rows[0] ? Number(r.rows[0].default_shift_hours) : 10;
  return Number.isFinite(h) && h > 0 ? h : 10;
}

async function linkedWorkerCode(ctx) {
  const r = await ctx.query(
    `SELECT worker_code FROM timesheet_worker_accounts WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
    [ctx.user.id]
  );
  if (!r.rows[0]) fail("WORKER_NOT_LINKED");
  return U.upper(r.rows[0].worker_code);
}

/* ---------------- settings ---------------- */

async function timesheetGetSettings(ctx) {
  ctx.requireAny(["timesheet.scan", "timesheet.settings.manage", "timesheet.portal.self", "timesheet.attendance.read"]);
  const r = await ctx.query(`SELECT default_shift_hours, updated_at FROM timesheet_settings WHERE id = 1`);
  const row = r.rows[0] || { default_shift_hours: 10, updated_at: null };
  return {
    defaultShiftHours: Number(row.default_shift_hours),
    updatedAt: U.isoOrNull(row.updated_at),
  };
}

async function timesheetSetSettings(ctx) {
  ctx.require("timesheet.settings.manage");
  const hours = U.num(ctx.params.defaultShiftHours, NaN);
  if (!Number.isFinite(hours) || hours <= 0) fail("VALIDATION", { field: "defaultShiftHours" });
  await ctx.query(
    `INSERT INTO timesheet_settings (id, default_shift_hours, updated_at, updated_by_user_id)
     VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET
       default_shift_hours = EXCLUDED.default_shift_hours,
       updated_at = now(),
       updated_by_user_id = EXCLUDED.updated_by_user_id`,
    [hours, ctx.user.id]
  );
  await ctx.audit({ action: "TIMESHEET_SETTINGS", detail: `defaultShiftHours=${hours}` });
  return { ok: true, defaultShiftHours: hours };
}

/* ---------------- attendance ---------------- */

async function timesheetPunch(ctx) {
  ctx.require("timesheet.scan");
  const worker = await requirePerson(ctx.query, ctx.params.workerCode || ctx.params.code);
  const project = await requireProject(ctx.query, ctx.params.projectId);
  const workDate = parseDate(ctx.params.workDate, todayLocalDate());
  const notes = U.trimmed(ctx.params.notes);
  const baseHours = await getShiftHours(ctx.query);

  const existing = await ctx.query(
    `SELECT a.id, a.project_id, p.name AS project_name
       FROM timesheet_attendance a
       JOIN projects p ON p.id = a.project_id
      WHERE a.worker_code = $1 AND a.work_date = $2 AND a.status = 'active'
      LIMIT 1`,
    [worker.code, workDate]
  );
  if (existing.rows[0]) {
    fail("ALREADY_PUNCHED", {
      workerCode: worker.code,
      workDate,
      projectId: existing.rows[0].project_id,
      projectName: existing.rows[0].project_name,
      attendanceId: existing.rows[0].id,
    });
  }

  let ins;
  try {
    ins = await ctx.query(
      `INSERT INTO timesheet_attendance
         (worker_code, work_date, project_id, base_hours, punched_by_user_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, punched_at, base_hours`,
      [worker.code, workDate, project.id, baseHours, ctx.user.id, notes]
    );
  } catch (e) {
    if (e && e.code === "23505") {
      fail("ALREADY_PUNCHED", { workerCode: worker.code, workDate });
    }
    throw e;
  }

  const row = ins.rows[0];
  await ctx.audit({
    action: "TIMESHEET_PUNCH",
    detail: `${worker.code} ${workDate} project=${project.id}`,
  });

  return {
    ok: true,
    attendance: {
      id: Number(row.id),
      workerCode: worker.code,
      workerName: worker.name,
      workDate,
      projectId: project.id,
      projectName: project.name,
      baseHours: Number(row.base_hours),
      punchedAt: U.isoOrNull(row.punched_at),
    },
  };
}

async function timesheetListAttendance(ctx) {
  ctx.requireAny(["timesheet.attendance.read", "timesheet.attendance.void", "timesheet.scan"]);
  const from = parseDate(ctx.params.from, null);
  const to = parseDate(ctx.params.to, null);
  const projectId = U.int(ctx.params.projectId, 0) || null;
  const workerCode = U.upper(ctx.params.workerCode || "");
  const status = U.trimmed(ctx.params.status || "active") || "active";

  const where = ["1=1"];
  const args = [];
  if (from) {
    args.push(from);
    where.push(`a.work_date >= $${args.length}`);
  }
  if (to) {
    args.push(to);
    where.push(`a.work_date <= $${args.length}`);
  }
  if (projectId) {
    args.push(projectId);
    where.push(`a.project_id = $${args.length}`);
  }
  if (workerCode) {
    args.push(workerCode);
    where.push(`a.worker_code = $${args.length}`);
  }
  if (status !== "all") {
    args.push(status);
    where.push(`a.status = $${args.length}`);
  }

  const r = await ctx.query(
    `SELECT a.*, c.description AS worker_name, p.name AS project_name, u.username AS punched_by,
            COALESCE((
              SELECT SUM(l.delta_hours)
                FROM timesheet_hour_adjustment_lines l
                JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
               WHERE l.worker_code = a.worker_code
                 AND h.work_date = a.work_date
                 AND h.status = 'active'
            ), 0) AS adjustment_hours
       FROM timesheet_attendance a
       JOIN catalog c ON c.code = a.worker_code
       JOIN projects p ON p.id = a.project_id
       JOIN users u ON u.id = a.punched_by_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.work_date DESC, a.punched_at DESC
      LIMIT 2000`,
    args
  );

  return {
    rows: r.rows.map((row) => {
      const baseHours = Number(row.base_hours);
      const adjustmentHours = Number(row.adjustment_hours) || 0;
      return {
        id: Number(row.id),
        workerCode: row.worker_code,
        workerName: row.worker_name,
        workDate: asDateOnly(row.work_date),
        projectId: row.project_id,
        projectName: row.project_name,
        baseHours,
        adjustmentHours,
        effectiveHours: Math.max(0, baseHours + adjustmentHours),
        punchedAt: U.isoOrNull(row.punched_at),
        punchedBy: row.punched_by,
        status: row.status,
        notes: row.notes || "",
      };
    }),
    total: r.rows.length,
  };
}

async function timesheetVoidAttendance(ctx) {
  ctx.require("timesheet.attendance.void");
  const id = U.int(ctx.params.id, 0);
  const reason = U.trimmed(ctx.params.reason);
  if (!id) fail("VALIDATION", { field: "id" });
  if (!reason) fail("VALIDATION", { field: "reason" });

  const cur = await ctx.query(`SELECT id, status FROM timesheet_attendance WHERE id = $1`, [id]);
  if (!cur.rows[0]) fail("NOT_FOUND");
  if (cur.rows[0].status === "voided") fail("ALREADY_VOIDED");

  await ctx.query(
    `UPDATE timesheet_attendance
        SET status = 'voided', voided_at = now(), voided_by_user_id = $2, void_reason = $3
      WHERE id = $1`,
    [id, ctx.user.id, reason]
  );
  await ctx.audit({ action: "TIMESHEET_VOID_ATTENDANCE", detail: `id=${id} ${reason}` });
  return { ok: true };
}

/* ---------------- hour adjustments ---------------- */

async function timesheetAdjustHours(ctx) {
  ctx.require("timesheet.hours.adjust");
  const workDate = parseDate(ctx.params.workDate, null);
  if (!workDate) fail("VALIDATION", { field: "workDate" });
  const reason = U.trimmed(ctx.params.reason);
  if (!reason) fail("VALIDATION", { field: "reason" });

  let lines = ctx.params.lines;
  if (typeof lines === "string") {
    try {
      lines = JSON.parse(lines);
    } catch {
      lines = [];
    }
  }
  if (!Array.isArray(lines) || !lines.length) fail("VALIDATION", { field: "lines" });

  const normalized = [];
  for (const line of lines) {
    const worker = await requirePerson(ctx.query, line.workerCode || line.code);
    const delta = U.num(line.deltaHours, NaN);
    if (!Number.isFinite(delta) || delta === 0) fail("VALIDATION", { field: "deltaHours", workerCode: worker.code });
    normalized.push({ workerCode: worker.code, deltaHours: delta });
  }

  const hdr = await ctx.query(
    `INSERT INTO timesheet_hour_adjustments (work_date, reason, created_by_user_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [workDate, reason, ctx.user.id]
  );
  const adjustmentId = hdr.rows[0].id;
  for (const line of normalized) {
    await ctx.query(
      `INSERT INTO timesheet_hour_adjustment_lines (adjustment_id, worker_code, delta_hours)
       VALUES ($1,$2,$3)`,
      [adjustmentId, line.workerCode, line.deltaHours]
    );
  }

  await ctx.audit({
    action: "TIMESHEET_ADJUST_HOURS",
    detail: `id=${adjustmentId} date=${workDate} lines=${normalized.length}`,
  });
  return { ok: true, adjustmentId: Number(adjustmentId), lineCount: normalized.length };
}

async function timesheetListHourAdjustments(ctx) {
  ctx.requireAny(["timesheet.hours.adjust", "timesheet.attendance.read"]);
  const from = parseDate(ctx.params.from, null);
  const to = parseDate(ctx.params.to, null);
  const workerCode = U.upper(ctx.params.workerCode || "");

  const where = ["h.status = 'active'"];
  const args = [];
  if (from) {
    args.push(from);
    where.push(`h.work_date >= $${args.length}`);
  }
  if (to) {
    args.push(to);
    where.push(`h.work_date <= $${args.length}`);
  }
  if (workerCode) {
    args.push(workerCode);
    where.push(`EXISTS (SELECT 1 FROM timesheet_hour_adjustment_lines l WHERE l.adjustment_id = h.id AND l.worker_code = $${args.length})`);
  }

  const hdrs = await ctx.query(
    `SELECT h.*, u.username AS created_by
       FROM timesheet_hour_adjustments h
       JOIN users u ON u.id = h.created_by_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY h.work_date DESC, h.id DESC
      LIMIT 500`,
    args
  );

  const rows = [];
  for (const h of hdrs.rows) {
    const lines = await ctx.query(
      `SELECT l.worker_code, l.delta_hours, c.description AS worker_name
         FROM timesheet_hour_adjustment_lines l
         JOIN catalog c ON c.code = l.worker_code
        WHERE l.adjustment_id = $1
        ORDER BY l.worker_code`,
      [h.id]
    );
    rows.push({
      id: Number(h.id),
      workDate: asDateOnly(h.work_date),
      reason: h.reason,
      createdBy: h.created_by,
      createdAt: U.isoOrNull(h.created_at),
      status: h.status,
      lines: lines.rows.map((l) => ({
        workerCode: l.worker_code,
        workerName: l.worker_name,
        deltaHours: Number(l.delta_hours),
      })),
    });
  }
  return { rows };
}

async function timesheetVoidHourAdjustment(ctx) {
  ctx.require("timesheet.hours.adjust");
  const id = U.int(ctx.params.id, 0);
  const reason = U.trimmed(ctx.params.reason);
  if (!id) fail("VALIDATION", { field: "id" });
  if (!reason) fail("VALIDATION", { field: "reason" });
  const cur = await ctx.query(`SELECT status FROM timesheet_hour_adjustments WHERE id = $1`, [id]);
  if (!cur.rows[0]) fail("NOT_FOUND");
  if (cur.rows[0].status === "voided") fail("ALREADY_VOIDED");
  await ctx.query(
    `UPDATE timesheet_hour_adjustments
        SET status='voided', voided_at=now(), voided_by_user_id=$2, void_reason=$3
      WHERE id=$1`,
    [id, ctx.user.id, reason]
  );
  await ctx.audit({ action: "TIMESHEET_VOID_ADJUST", detail: `id=${id}` });
  return { ok: true };
}

/* ---------------- deductions ---------------- */

async function timesheetCreateDeduction(ctx) {
  ctx.require("timesheet.deductions.manage");
  const worker = await requirePerson(ctx.query, ctx.params.workerCode);
  const workDate = parseDate(ctx.params.workDate, todayLocalDate());
  const dedType = U.trimmed(ctx.params.dedType || ctx.params.type).toLowerCase();
  if (!DED_TYPES.has(dedType)) fail("VALIDATION", { field: "dedType", allowed: [...DED_TYPES] });
  const amount = U.num(ctx.params.amount, NaN);
  if (!Number.isFinite(amount) || amount < 0) fail("VALIDATION", { field: "amount" });
  const currency = U.trimmed(ctx.params.currency) || "USD";
  const note = U.trimmed(ctx.params.note);
  let projectId = null;
  if (ctx.params.projectId !== undefined && ctx.params.projectId !== null && ctx.params.projectId !== "") {
    projectId = (await requireProject(ctx.query, ctx.params.projectId)).id;
  }

  const ins = await ctx.query(
    `INSERT INTO timesheet_deductions
       (worker_code, work_date, project_id, ded_type, amount, currency, note, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, created_at`,
    [worker.code, workDate, projectId, dedType, amount, currency, note, ctx.user.id]
  );
  await ctx.audit({ action: "TIMESHEET_DEDUCTION", detail: `${worker.code} ${dedType} ${amount}` });
  return {
    ok: true,
    deduction: {
      id: Number(ins.rows[0].id),
      workerCode: worker.code,
      workerName: worker.name,
      workDate,
      projectId,
      dedType,
      amount,
      currency,
      note,
      createdAt: U.isoOrNull(ins.rows[0].created_at),
    },
  };
}

async function timesheetListDeductions(ctx) {
  ctx.require("timesheet.deductions.manage");
  const from = parseDate(ctx.params.from, null);
  const to = parseDate(ctx.params.to, null);
  const workerCode = U.upper(ctx.params.workerCode || "");
  const where = ["d.status = 'active'"];
  const args = [];
  if (from) {
    args.push(from);
    where.push(`d.work_date >= $${args.length}`);
  }
  if (to) {
    args.push(to);
    where.push(`d.work_date <= $${args.length}`);
  }
  if (workerCode) {
    args.push(workerCode);
    where.push(`d.worker_code = $${args.length}`);
  }
  const r = await ctx.query(
    `SELECT d.*, c.description AS worker_name
       FROM timesheet_deductions d
       JOIN catalog c ON c.code = d.worker_code
      WHERE ${where.join(" AND ")}
      ORDER BY d.work_date DESC, d.id DESC
      LIMIT 2000`,
    args
  );
  return {
    rows: r.rows.map((row) => ({
      id: Number(row.id),
      workerCode: row.worker_code,
      workerName: row.worker_name,
      workDate: asDateOnly(row.work_date),
      projectId: row.project_id,
      dedType: row.ded_type,
      amount: Number(row.amount),
      currency: row.currency,
      note: row.note || "",
      status: row.status,
    })),
  };
}

async function timesheetVoidDeduction(ctx) {
  ctx.require("timesheet.deductions.manage");
  const id = U.int(ctx.params.id, 0);
  const reason = U.trimmed(ctx.params.reason);
  if (!id) fail("VALIDATION", { field: "id" });
  if (!reason) fail("VALIDATION", { field: "reason" });
  const cur = await ctx.query(`SELECT status FROM timesheet_deductions WHERE id = $1`, [id]);
  if (!cur.rows[0]) fail("NOT_FOUND");
  if (cur.rows[0].status === "voided") fail("ALREADY_VOIDED");
  await ctx.query(
    `UPDATE timesheet_deductions
        SET status='voided', voided_at=now(), voided_by_user_id=$2, void_reason=$3
      WHERE id=$1`,
    [id, ctx.user.id, reason]
  );
  await ctx.audit({ action: "TIMESHEET_VOID_DEDUCTION", detail: `id=${id}` });
  return { ok: true };
}

/* ---------------- worker accounts ---------------- */

async function timesheetLinkWorkerAccount(ctx) {
  ctx.require("timesheet.worker_accounts.manage");
  const userId = U.int(ctx.params.userId, 0);
  if (!userId) fail("VALIDATION", { field: "userId" });
  const worker = await requirePerson(ctx.query, ctx.params.workerCode);
  const u = await ctx.query(`SELECT id, username, role FROM users WHERE id = $1`, [userId]);
  if (!u.rows[0]) fail("NOT_FOUND", { field: "userId" });

  try {
    await ctx.query(
      `INSERT INTO timesheet_worker_accounts (user_id, worker_code, created_by_user_id, is_active)
       VALUES ($1,$2,$3,TRUE)
       ON CONFLICT (user_id) DO UPDATE SET
         worker_code = EXCLUDED.worker_code,
         is_active = TRUE,
         created_by_user_id = EXCLUDED.created_by_user_id`,
      [userId, worker.code, ctx.user.id]
    );
  } catch (e) {
    if (e && e.code === "23505") fail("VALIDATION", { error: "WORKER_CODE_ALREADY_LINKED" });
    throw e;
  }
  await ctx.audit({
    action: "TIMESHEET_LINK_WORKER",
    detail: `user=${u.rows[0].username} worker=${worker.code}`,
  });
  return { ok: true, userId, workerCode: worker.code };
}

async function timesheetUnlinkWorkerAccount(ctx) {
  ctx.require("timesheet.worker_accounts.manage");
  const userId = U.int(ctx.params.userId, 0);
  const workerCode = U.upper(ctx.params.workerCode || "");
  if (!userId && !workerCode) fail("VALIDATION", { field: "userId|workerCode" });
  if (userId) {
    await ctx.query(`DELETE FROM timesheet_worker_accounts WHERE user_id = $1`, [userId]);
  } else {
    await ctx.query(`DELETE FROM timesheet_worker_accounts WHERE worker_code = $1`, [workerCode]);
  }
  await ctx.audit({ action: "TIMESHEET_UNLINK_WORKER", detail: `userId=${userId} worker=${workerCode}` });
  return { ok: true };
}

async function timesheetListWorkerAccounts(ctx) {
  ctx.require("timesheet.worker_accounts.manage");
  const r = await ctx.query(
    `SELECT a.user_id, a.worker_code, a.is_active, a.created_at,
            u.username, u.full_name, u.role,
            c.description AS worker_name
       FROM timesheet_worker_accounts a
       JOIN users u ON u.id = a.user_id
       JOIN catalog c ON c.code = a.worker_code
      ORDER BY u.username`
  );
  return {
    rows: r.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name || "",
      role: row.role,
      workerCode: row.worker_code,
      workerName: row.worker_name,
      isActive: row.is_active !== false,
      createdAt: U.isoOrNull(row.created_at),
    })),
  };
}

/* ---------------- worker portal ---------------- */

async function timesheetMySummary(ctx) {
  ctx.require("timesheet.portal.self");
  const workerCode = await linkedWorkerCode(ctx);
  const def = monthRange();
  const from = parseDate(ctx.params.from, def.from);
  const to = parseDate(ctx.params.to, def.to);
  const person = await requirePerson(ctx.query, workerCode);

  const att = await ctx.query(
    `SELECT COALESCE(SUM(base_hours),0) AS base_hours, COUNT(*)::int AS days
       FROM timesheet_attendance
      WHERE worker_code = $1 AND status = 'active'
        AND work_date >= $2 AND work_date <= $3`,
    [workerCode, from, to]
  );
  const adj = await ctx.query(
    `SELECT COALESCE(SUM(l.delta_hours),0) AS delta
       FROM timesheet_hour_adjustment_lines l
       JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
      WHERE l.worker_code = $1 AND h.status = 'active'
        AND h.work_date >= $2 AND h.work_date <= $3`,
    [workerCode, from, to]
  );
  const ded = await ctx.query(
    `SELECT COALESCE(SUM(amount),0) AS total, COALESCE(MAX(currency),'USD') AS currency
       FROM timesheet_deductions
      WHERE worker_code = $1 AND status = 'active'
        AND work_date >= $2 AND work_date <= $3`,
    [workerCode, from, to]
  );

  const baseHours = Number(att.rows[0].base_hours);
  const adjustmentHours = Number(adj.rows[0].delta);
  const netHours = Math.max(0, baseHours + adjustmentHours);

  return {
    workerCode,
    workerName: person.name,
    from,
    to,
    daysPresent: att.rows[0].days,
    baseHours,
    adjustmentHours,
    netHours,
    deductionsTotal: Number(ded.rows[0].total),
    currency: ded.rows[0].currency || "USD",
  };
}

async function timesheetMyAttendance(ctx) {
  ctx.require("timesheet.portal.self");
  const workerCode = await linkedWorkerCode(ctx);
  const def = monthRange();
  const from = parseDate(ctx.params.from, def.from);
  const to = parseDate(ctx.params.to, def.to);
  const r = await ctx.query(
    `SELECT a.work_date, a.project_id, a.base_hours, a.status, p.name AS project_name,
            COALESCE((
              SELECT SUM(l.delta_hours)
                FROM timesheet_hour_adjustment_lines l
                JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
               WHERE l.worker_code = a.worker_code
                 AND h.work_date = a.work_date
                 AND h.status = 'active'
            ), 0) AS adjustment_hours
       FROM timesheet_attendance a
       JOIN projects p ON p.id = a.project_id
      WHERE a.worker_code = $1 AND a.status = 'active'
        AND a.work_date >= $2 AND a.work_date <= $3
      ORDER BY a.work_date DESC`,
    [workerCode, from, to]
  );
  return {
    rows: r.rows.map((row) => {
      const baseHours = Number(row.base_hours);
      const adjustmentHours = Number(row.adjustment_hours) || 0;
      return {
        workDate: asDateOnly(row.work_date),
        projectId: row.project_id,
        projectName: row.project_name,
        baseHours,
        adjustmentHours,
        netHours: Math.max(0, baseHours + adjustmentHours),
        status: row.status,
      };
    }),
  };
}

async function timesheetMyHours(ctx) {
  ctx.require("timesheet.portal.self");
  const workerCode = await linkedWorkerCode(ctx);
  const def = monthRange();
  const from = parseDate(ctx.params.from, def.from);
  const to = parseDate(ctx.params.to, def.to);

  const att = await ctx.query(
    `SELECT work_date, base_hours FROM timesheet_attendance
      WHERE worker_code = $1 AND status = 'active' AND work_date >= $2 AND work_date <= $3`,
    [workerCode, from, to]
  );
  const adj = await ctx.query(
    `SELECT h.work_date, l.delta_hours, h.reason
       FROM timesheet_hour_adjustment_lines l
       JOIN timesheet_hour_adjustments h ON h.id = l.adjustment_id
      WHERE l.worker_code = $1 AND h.status = 'active'
        AND h.work_date >= $2 AND h.work_date <= $3`,
    [workerCode, from, to]
  );

  const byDay = new Map();
  for (const row of att.rows) {
    const key = String(row.work_date).slice(0, 10);
    byDay.set(key, { workDate: key, baseHours: Number(row.base_hours), adjustmentHours: 0, adjustments: [] });
  }
  for (const row of adj.rows) {
    const key = String(row.work_date).slice(0, 10);
    if (!byDay.has(key)) {
      byDay.set(key, { workDate: key, baseHours: 0, adjustmentHours: 0, adjustments: [] });
    }
    const d = byDay.get(key);
    d.adjustmentHours += Number(row.delta_hours);
    d.adjustments.push({ deltaHours: Number(row.delta_hours), reason: row.reason || "" });
  }

  const rows = [...byDay.values()]
    .map((d) => ({
      ...d,
      netHours: Math.max(0, d.baseHours + d.adjustmentHours),
    }))
    .sort((a, b) => (a.workDate < b.workDate ? 1 : -1));

  return { rows };
}

async function timesheetMyDeductions(ctx) {
  ctx.require("timesheet.portal.self");
  const workerCode = await linkedWorkerCode(ctx);
  const def = monthRange();
  const from = parseDate(ctx.params.from, def.from);
  const to = parseDate(ctx.params.to, def.to);
  const r = await ctx.query(
    `SELECT work_date, ded_type, amount, currency, note
       FROM timesheet_deductions
      WHERE worker_code = $1 AND status = 'active'
        AND work_date >= $2 AND work_date <= $3
      ORDER BY work_date DESC`,
    [workerCode, from, to]
  );
  return {
    rows: r.rows.map((row) => ({
      workDate: asDateOnly(row.work_date),
      dedType: row.ded_type,
      amount: Number(row.amount),
      currency: row.currency,
      note: row.note || "",
    })),
  };
}

async function timesheetMyOutstandingTools(ctx) {
  ctx.require("timesheet.portal.self");
  const workerCode = await linkedWorkerCode(ctx);
  const ledger = await ctx.ledger();
  const overdueDays = Math.max(1, U.int(ctx.params.overdueDays, 1));
  const held = custody.holdingsForPerson(ledger, workerCode, { overdueDays, now: Date.now() });
  return {
    workerCode,
    rows: (held || []).map((t) => ({
      code: t.code,
      description: t.description || "",
      qty: t.qty,
      daysOut: t.daysOut,
      since: t.since || t.outAt || null,
    })),
  };
}

module.exports = {
  timesheetGetSettings,
  timesheetSetSettings,
  timesheetPunch,
  timesheetListAttendance,
  timesheetVoidAttendance,
  timesheetAdjustHours,
  timesheetListHourAdjustments,
  timesheetVoidHourAdjustment,
  timesheetCreateDeduction,
  timesheetListDeductions,
  timesheetVoidDeduction,
  timesheetLinkWorkerAccount,
  timesheetUnlinkWorkerAccount,
  timesheetListWorkerAccounts,
  timesheetMySummary,
  timesheetMyAttendance,
  timesheetMyHours,
  timesheetMyDeductions,
  timesheetMyOutstandingTools,
};
