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
  ctx.require("logs.view");
  const r = await ctx.query(
    `SELECT DISTINCT row_date FROM scans WHERE row_date <> '' ORDER BY row_date`
  );
  return r.rows.map((x) => x.row_date);
}

/** Legacy tape feed consumed by the client-side CustodyParser pages. */
async function getData(ctx) {
  ctx.require("logs.view");
  const targetDate = U.str(ctx.params.date);
  const r = await ctx.query(
    `SELECT s.tool_code, s.row_date, s.scanned_at, s.created_by,
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
    createdBy: row.created_by || "",
  }));
}

function buildScanLogWhere(params) {
  const conditions = [];
  const args = [];
  let n = 1;
  const date = U.trimmed(params.date);
  const user = U.trimmed(params.user);
  const q = U.trimmed(params.q);

  if (date) {
    conditions.push(`REPLACE(REPLACE(s.row_date,'{',''),'}','') = $${n++}`);
    args.push(U.stripBraces(date));
  }
  if (user) {
    conditions.push(`s.created_by ILIKE $${n++}`);
    args.push(user);
  }
  if (q) {
    const like = `%${U.upper(q)}%`;
    conditions.push(
      `(UPPER(s.tool_code) LIKE $${n} OR UPPER(COALESCE(c.description,'')) LIKE $${n})`
    );
    args.push(like);
    n++;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    args,
    nextIndex: n,
  };
}

async function getScanLog(ctx) {
  ctx.requireAny(["logs.view", "audit.view", "reports.all"]);
  const limit = Math.min(20000, U.posInt(ctx.params.limit, 500));
  const offset = Math.max(0, U.posInt(ctx.params.offset, 0));
  const { where, args, nextIndex } = buildScanLogWhere(ctx.params);
  const countArgs = [...args];
  const countR = await ctx.query(
    `SELECT COUNT(*)::int AS c
       FROM scans s
       LEFT JOIN catalog c ON c.code = s.tool_code
       ${where}`,
    countArgs
  );
  const listArgs = [...args, limit, offset];
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
      LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    listArgs
  );

  const payload = {
    total: countR.rows[0]?.c || 0,
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

  if (U.bool(ctx.params.includeMeta)) {
    const usersR = await ctx.query(
      `SELECT created_by AS user, COUNT(*)::int AS count
         FROM scans
        WHERE COALESCE(created_by,'') <> ''
        GROUP BY created_by
        ORDER BY count DESC
        LIMIT 120`
    );
    payload.meta = { scanUsers: usersR.rows.map((row) => row.user) };
  }

  return payload;
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
    username: ctx.user.username,
    role: ctx.role,
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
  const limit = Math.min(2000, U.posInt(ctx.params.limit, 500));
  const offset = Math.max(0, U.posInt(ctx.params.offset, 0));
  const user = U.trimmed(ctx.params.user);
  const action = U.trimmed(ctx.params.action);
  const q = U.trimmed(ctx.params.q);

  const conditions = [];
  const args = [];
  let n = 1;
  if (user) {
    conditions.push(`username ILIKE $${n++}`);
    args.push(user);
  }
  if (action) {
    conditions.push(`action = $${n++}`);
    args.push(action);
  }
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      `(username ILIKE $${n} OR action ILIKE $${n} OR detail ILIKE $${n} OR before_state ILIKE $${n} OR after_state ILIKE $${n} OR device ILIKE $${n})`
    );
    args.push(like);
    n++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await ctx.query(
    `SELECT COUNT(*)::int AS c FROM audit_log ${where}`,
    args
  );
  const listArgs = [...args, limit, offset];
  const r = await ctx.query(
    `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT $${n} OFFSET $${n + 1}`,
    listArgs
  );

  const payload = {
    total: countR.rows[0]?.c || 0,
    items: r.rows.map((row) => ({
      id: row.id,
      timestamp: U.isoOrNull(row.created_at),
      dateTimeLabel: U.fmtDateTime(row.created_at),
      user: row.username || "",
      role: row.role || "",
      action: row.action,
      before: row.before_state || "",
      after: row.after_state || "",
      detail: row.detail || "",
      device: row.device || "",
    })),
  };

  if (U.bool(ctx.params.includeMeta)) {
    const [usersR, actionsR, scanUsersR] = await Promise.all([
      ctx.query(
        `SELECT username AS user, COUNT(*)::int AS count
           FROM audit_log
          WHERE COALESCE(username,'') <> ''
          GROUP BY username
          ORDER BY count DESC
          LIMIT 120`
      ),
      ctx.query(
        `SELECT action, COUNT(*)::int AS count
           FROM audit_log
          GROUP BY action
          ORDER BY count DESC
          LIMIT 120`
      ),
      ctx.query(
        `SELECT created_by AS user, COUNT(*)::int AS count
           FROM scans
          WHERE COALESCE(created_by,'') <> ''
          GROUP BY created_by
          ORDER BY count DESC
          LIMIT 120`
      ),
    ]);
    payload.meta = {
      users: usersR.rows,
      actions: actionsR.rows,
      scanUsers: scanUsersR.rows,
    };
  }

  return payload;
}

module.exports = {
  getDates,
  getData,
  getScanLog,
  searchAll,
  auditLog,
  getAuditLog,
};
