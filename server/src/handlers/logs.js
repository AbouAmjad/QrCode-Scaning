const U = require("../lib/util");

function classify(code) {
  const c = U.upper(code);
  if (U.isDirection(c)) return "direction";
  if (U.isPersonCode(c)) return "person";
  if (U.isConsumableCode(c)) return "consumable";
  if (U.isToolCode(c)) return "tool";
  return "unknown";
}

async function getDates(ctx) {
  const r = await ctx.query(
    `SELECT DISTINCT row_date FROM scans WHERE row_date <> '' ORDER BY row_date`
  );
  return r.rows.map((x) => x.row_date);
}

/** Legacy tape feed consumed by the client-side CustodyParser pages. */
async function getData(ctx) {
  const targetDate = U.str(ctx.params.date);
  const r = await ctx.query(
    `SELECT s.tool_code, s.row_date, s.scanned_at,
            COALESCE(c.description, s.tool_code) AS description
       FROM scans s
       LEFT JOIN catalog c ON c.code = s.tool_code
      ORDER BY s.scanned_at ASC, s.id ASC`
  );
  return r.rows.map((row) => ({
    toolCode: row.tool_code,
    toolDescription: row.description,
    rowDate: row.row_date,
    timestamp: U.isoOrNull(row.scanned_at) || row.row_date,
    isTargetDay: String(row.row_date === targetDate),
  }));
}

async function getScanLog(ctx) {
  ctx.requireAny(["logs.view", "audit.view", "reports.all"]);
  const limit = Math.min(20000, U.posInt(ctx.params.limit, 3000));
  const date = U.trimmed(ctx.params.date);
  const args = [limit];
  let where = "";
  if (date) {
    args.unshift(U.stripBraces(date));
    where = `WHERE REPLACE(REPLACE(s.row_date,'{',''),'}','') = $1`;
  }

  const r = await ctx.query(
    `SELECT s.id, s.tool_code, s.row_date, s.scanned_at, s.created_by,
            COALESCE(s.device_id,'')  AS device_id,
            COALESCE(s.session_id,'') AS session_id,
            COALESCE(c.description, '') AS description,
            COALESCE(c.kind, '') AS kind
       FROM scans s
       LEFT JOIN catalog c ON c.code = s.tool_code
       ${where}
      ORDER BY s.id DESC
      LIMIT $${args.length}`,
    args
  );

  return {
    items: r.rows.map((row) => ({
      id: row.id,
      code: U.upper(row.tool_code),
      description: row.description || "",
      kind: row.kind || "",
      type: classify(row.tool_code),
      rowDate: row.row_date,
      timestamp: U.isoOrNull(row.scanned_at),
      dateLabel: U.fmtDate(row.scanned_at),
      dateTimeLabel: U.fmtDateTime(row.scanned_at),
      createdBy: row.created_by || "",
      deviceId: row.device_id || "",
      sessionId: row.session_id || "",
    })),
  };
}

async function searchAll(ctx) {
  ctx.requireAny(["tool.search", "logs.view"]);
  const q = U.upper(ctx.params.q);
  if (!q) return { items: [] };
  const like = `%${q}%`;

  const [catalog, scans] = await Promise.all([
    ctx.query(
      `SELECT code, description, kind FROM catalog
        WHERE UPPER(code) LIKE $1 OR UPPER(description) LIKE $1
        ORDER BY code ASC LIMIT 40`,
      [like]
    ),
    ctx.query(
      `SELECT tool_code, row_date, scanned_at FROM scans
        WHERE UPPER(tool_code) LIKE $1 OR UPPER(row_date) LIKE $1
        ORDER BY id DESC LIMIT 60`,
      [like]
    ),
  ]);

  return {
    q,
    catalog: catalog.rows.map((row) => ({
      type: row.kind === "person" ? "person" : "tool",
      code: U.upper(row.code),
      description: row.description || "",
    })),
    items: scans.rows.map((row) => ({
      type: classify(row.tool_code),
      code: U.upper(row.tool_code),
      timestamp: U.isoOrNull(row.scanned_at),
      rowDate: row.row_date,
    })),
  };
}

async function auditLog(ctx) {
  await ctx.audit({
    username: U.trimmed(ctx.params.user) || ctx.user.username,
    role: U.trimmed(ctx.params.role) || ctx.role,
    action: U.trimmed(ctx.params.auditAction || ctx.params.event) || "CLIENT_EVENT",
    before: U.str(ctx.params.before),
    after: U.str(ctx.params.after),
    detail: U.str(ctx.params.detail),
    device: U.str(ctx.params.device),
  });
  return { success: true, ok: true };
}

async function getAuditLog(ctx) {
  ctx.requireAny(["audit.view", "settings.manage"]);
  const limit = Math.min(2000, U.posInt(ctx.params.limit, 200));
  const r = await ctx.query(`SELECT * FROM audit_log ORDER BY id DESC LIMIT $1`, [limit]);
  return {
    items: r.rows.map((row) => ({
      id: row.id,
      timestamp: U.isoOrNull(row.created_at),
      user: row.username || "",
      role: row.role || "",
      action: row.action,
      before: row.before_state || "",
      after: row.after_state || "",
      detail: row.detail || "",
      device: row.device || "",
    })),
  };
}

module.exports = {
  getDates,
  getData,
  getScanLog,
  searchAll,
  auditLog,
  getAuditLog,
};
