const U = require("../lib/util");
const stockLib = require("../lib/stock");

async function listQcItems(ctx) {
  ctx.requireAny(["qc.view", "qc.manage"]);
  const filter = U.trimmed(ctx.params.status) || "all";
  const now = Date.now();

  const r = await ctx.query(
    `SELECT c.code, c.description, c.category, c.subcategory,
            c.calibration_required, c.calibration_last_done, c.calibration_next_due,
            c.calibration_notes
       FROM catalog c
      WHERE c.kind <> 'person' AND c.calibration_required = TRUE
      ORDER BY c.calibration_next_due ASC NULLS LAST, c.code ASC`
  );

  const all = r.rows.map((row) => {
    const qc = stockLib.qcStatusFor(row.calibration_next_due, now);
    const status = !row.calibration_next_due
      ? "Missing"
      : qc.qcStatus === "Expired"
        ? "Overdue"
        : qc.qcStatus === "Due soon"
          ? "Due soon"
          : "OK";
    return {
      code: U.upper(row.code),
      description: row.description || row.code,
      category: row.category || "",
      subcategory: row.subcategory || "",
      calibrationLastDone: row.calibration_last_done ? U.isoDateOnly(row.calibration_last_done) : "",
      calibrationNextDue: row.calibration_next_due ? U.isoDateOnly(row.calibration_next_due) : "",
      notes: row.calibration_notes || "",
      daysLeft: qc.qcDaysLeft,
      status,
    };
  });

  const summary = {
    total: all.length,
    overdue: all.filter((i) => i.status === "Overdue").length,
    dueSoon: all.filter((i) => i.status === "Due soon").length,
    ok: all.filter((i) => i.status === "OK").length,
    missing: all.filter((i) => i.status === "Missing").length,
  };

  const map = {
    overdue: "Overdue",
    due: "Due soon",
    dueSoon: "Due soon",
    ok: "OK",
    missing: "Missing",
  };
  const items = filter === "all" ? all : all.filter((i) => i.status === map[filter]);

  return { items, summary, filter };
}

async function recordCalibration(ctx) {
  ctx.require("qc.manage");
  const { params, query } = ctx;
  const code = U.upper(params.code);
  if (!code) return { success: false, error: "CODE_REQUIRED" };

  const lastDone = U.nullableDate(params.calibrationLastDone) || U.isoDateOnly(new Date());
  const nextDue = U.nullableDate(params.calibrationNextDue);
  if (!nextDue) return { success: false, error: "CALIBRATION_DUE_REQUIRED" };

  const notes = U.trimmed(params.notes);
  const upd = await query(
    `UPDATE catalog
        SET calibration_required = TRUE,
            calibration_last_done = $2,
            calibration_next_due = $3,
            calibration_notes = $4,
            updated_at = NOW()
      WHERE code = $1
      RETURNING code`,
    [code, lastDone, nextDue, notes]
  );
  if (!upd.rows.length) return { success: false, error: "NOT_FOUND" };

  await query(
    `INSERT INTO qc_calibrations (code, last_done, next_due, notes, by_user)
     VALUES ($1,$2,$3,$4,$5)`,
    [code, lastDone, nextDue, notes, ctx.user.username]
  );
  await ctx.audit({
    action: "QC_CALIBRATION",
    after: JSON.stringify({ code, lastDone, nextDue }),
  });
  return { success: true, code, calibrationLastDone: lastDone, calibrationNextDue: nextDue };
}

module.exports = { listQcItems, recordCalibration };
