const U = require("../lib/util");
const custody = require("../custody");

/** How long a heartbeat keeps the terminal lease alive (client beats @5s). */
const LEASE_MS = Number(process.env.TERMINAL_LEASE_MS || 20000) || 20000;

/* ------------------------------------------------------ session leasing */

function leaseUntil() {
  return new Date(Date.now() + LEASE_MS);
}

async function activeSessions(query, username) {
  const r = await query(
    `SELECT * FROM terminal_sessions
      WHERE username = $1 AND (lease_until > NOW() OR blocked_reason <> '')`,
    [username]
  );
  return r.rows;
}

function sessionKeys(params) {
  return {
    deviceId: U.trimmed(params.deviceId),
    sessionId: U.trimmed(params.sessionId),
  };
}

async function acquireTerminalSession(ctx) {
  ctx.requireAny(["terminal.use", "tool.checkout", "tool.return"]);
  const { query, user } = ctx;
  const { deviceId, sessionId } = sessionKeys(ctx.params);
  if (!deviceId || !sessionId) return { success: false, error: "TERMINAL_SESSION_REQUIRED" };

  const rows = await activeSessions(query, user.username);
  const mine = rows.find((r) => r.device_id === deviceId && r.session_id === sessionId);
  if (mine && mine.blocked_reason) {
    return { success: false, error: "TERMINAL_SESSION_BLOCKED", reason: mine.blocked_reason };
  }
  const conflict = rows.find((r) => r.session_id !== sessionId);
  if (conflict) {
    if (conflict.blocked_reason) {
      return { success: false, error: "TERMINAL_SESSION_BLOCKED", reason: conflict.blocked_reason };
    }
    return {
      success: false,
      error: "TERMINAL_SESSION_CONFLICT",
      deviceId: conflict.device_id,
    };
  }

  await query(
    `INSERT INTO terminal_sessions (username, device_id, session_id, lease_until, blocked_reason, updated_at)
     VALUES ($1,$2,$3,$4,'',NOW())
     ON CONFLICT (username, device_id)
     DO UPDATE SET session_id = EXCLUDED.session_id,
                   lease_until = EXCLUDED.lease_until,
                   blocked_reason = '',
                   updated_at = NOW()`,
    [user.username, deviceId, sessionId, leaseUntil()]
  );
  return { success: true, deviceId, sessionId, leaseMs: LEASE_MS };
}

async function heartbeatTerminalSession(ctx) {
  const { query, user } = ctx;
  const { deviceId, sessionId } = sessionKeys(ctx.params);
  if (!deviceId || !sessionId) return { success: false, error: "TERMINAL_SESSION_REQUIRED" };

  const r = await query(
    `SELECT * FROM terminal_sessions WHERE username = $1 AND device_id = $2`,
    [user.username, deviceId]
  );
  const row = r.rows[0];
  if (!row) return { success: false, error: "TERMINAL_SESSION_REQUIRED" };
  if (row.blocked_reason) {
    return { success: false, error: "TERMINAL_SESSION_BLOCKED", reason: row.blocked_reason };
  }
  if (row.session_id !== sessionId) return { success: false, error: "TERMINAL_SESSION_CONFLICT" };

  await query(
    `UPDATE terminal_sessions SET lease_until = $1, updated_at = NOW()
      WHERE username = $2 AND device_id = $3`,
    [leaseUntil(), user.username, deviceId]
  );
  return { success: true, leaseMs: LEASE_MS };
}

async function releaseTerminalSession(ctx) {
  const { query, user } = ctx;
  const { deviceId, sessionId } = sessionKeys(ctx.params);
  if (!deviceId) return { success: true };
  await query(
    `DELETE FROM terminal_sessions
      WHERE username = $1 AND device_id = $2 AND ($3 = '' OR session_id = $3)`,
    [user.username, deviceId, sessionId]
  );
  return { success: true };
}

/** Hard reset: drops every lease for this login so a clean one can be taken. */
async function resetTerminalSession(ctx) {
  const { query, user } = ctx;
  await query(`DELETE FROM terminal_sessions WHERE username = $1`, [user.username]);
  await ctx.audit({ action: "TERMINAL_SESSION_RESET" });
  return { success: true };
}

async function blockSession(query, username, deviceId, reason) {
  if (!deviceId) return;
  await query(
    `UPDATE terminal_sessions SET blocked_reason = $1, updated_at = NOW()
      WHERE username = $2 AND device_id = $3`,
    [reason, username, deviceId]
  );
}

async function assertSession(ctx) {
  const { deviceId, sessionId } = sessionKeys(ctx.params);
  // Non-terminal clients (integrations, curl) do not carry a lease.
  if (!deviceId && !sessionId) return null;
  const r = await ctx.query(
    `SELECT * FROM terminal_sessions WHERE username = $1 AND device_id = $2`,
    [ctx.user.username, deviceId]
  );
  const row = r.rows[0];
  if (!row) return "TERMINAL_SESSION_REQUIRED";
  if (row.blocked_reason) return "TERMINAL_SESSION_BLOCKED";
  if (row.session_id !== sessionId) return "TERMINAL_SESSION_CONFLICT";
  if (new Date(row.lease_until).getTime() < Date.now() - LEASE_MS) {
    return "TERMINAL_SESSION_REQUIRED";
  }
  return null;
}

/* ------------------------------------------------------ code validation */

async function checkScanCode(ctx) {
  const code = U.upper(ctx.params.code);
  const expectKind = U.trimmed(ctx.params.expectKind);
  if (!code) return { ok: false, found: false, error: "UNKNOWN_CODE" };
  if (U.isDirection(code)) {
    return { ok: true, found: true, code, kind: "direction", description: code, serialized: false };
  }

  const r = await ctx.query(
    `SELECT code, description, kind, serialized FROM catalog WHERE code = $1`,
    [code]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, found: false, code, error: "UNKNOWN_CODE" };

  const kind = row.kind || (U.isPersonCode(code) ? "person" : "tool");
  const description = U.trimmed(row.description);
  if (!description || U.upper(description) === code) {
    return { ok: false, found: true, code, kind, error: "NO_DESCRIPTION" };
  }
  if (expectKind === "person" && kind !== "person") {
    return { ok: false, found: true, code, kind, error: "NOT_A_PERSON" };
  }
  if (expectKind === "item" && kind === "person") {
    return { ok: false, found: true, code, kind, error: "NOT_A_PRODUCT" };
  }

  return { ok: true, found: true, code, kind, description, serialized: row.serialized === true };
}

/* ----------------------------------------------------------- PPE window */

/**
 * Kept under its historical (misspelled) action name so deployed frontends
 * keep working — see `checkPpeCooldownoldown` in the action table.
 */
async function checkPpeCooldown(ctx) {
  const personCode = U.upper(ctx.params.personCode);
  const itemCode = U.upper(ctx.params.itemCode || ctx.params.code);
  const cooldownDays = U.PPE_COOLDOWN_DAYS;
  if (!personCode || !itemCode) return { applies: false };

  const r = await ctx.query(`SELECT description FROM catalog WHERE code = $1`, [itemCode]);
  const description = (r.rows[0] && r.rows[0].description) || "";
  const family = U.matchPpeFamily(`${itemCode} ${description}`);
  if (!family) return { applies: false, personCode, itemCode, cooldownDays };

  const ledger = await ctx.ledger();
  const last = custody.lastPpeIssue(ledger, personCode, family.id, U.matchPpeFamily);
  if (!last) {
    return {
      applies: true,
      restricted: false,
      family: family.id,
      familyLabel: family.label,
      cooldownDays,
      personCode,
      itemCode,
    };
  }

  const daysAgo = U.daysSince(last.scannedAt);
  return {
    applies: true,
    restricted: daysAgo < cooldownDays,
    family: family.id,
    familyLabel: family.label,
    cooldownDays,
    personCode,
    itemCode,
    lastCode: last.code,
    lastDescription: last.description || "",
    lastIssuedAt: U.isoOrNull(last.scannedAt),
    lastIssuedLabel: U.fmtDateTime(last.scannedAt),
    daysAgo,
    daysLeft: Math.max(0, cooldownDays - daysAgo),
  };
}

/* --------------------------------------------------------- scan intake */

/**
 * Replays only the tail of this terminal's own session so we know which person
 * and direction the incoming item scan belongs to.
 */
async function sessionState(ctx) {
  const { deviceId, sessionId } = sessionKeys(ctx.params);
  const r = await ctx.query(
    `SELECT tool_code FROM (
       SELECT tool_code, id FROM scans
        WHERE ($1 = '' OR device_id = $1) AND ($2 = '' OR session_id = $2)
        ORDER BY id DESC LIMIT 300
     ) t ORDER BY id ASC`,
    [deviceId, sessionId]
  );
  let personCode = null;
  let direction = null;
  for (const row of r.rows) {
    const code = U.upper(row.tool_code);
    if (U.isPersonCode(code)) {
      personCode = code;
      direction = null;
    } else if (U.isDirection(code)) {
      direction = code;
    }
  }
  return { personCode, direction };
}

async function appendScan(ctx) {
  const { params, query, user } = ctx;
  const code = U.upper(params.scanData);
  if (!code) return { error: "NO CODE" };

  const sessionError = await assertSession(ctx);
  if (sessionError) return { error: sessionError };

  const isDir = U.isDirection(code);
  const validation = await checkScanCode({ ...ctx, params: { code } });
  if (!isDir && !validation.ok) {
    return { error: validation.error || "UNKNOWN_CODE", code };
  }

  const state = await sessionState(ctx);

  if (!isDir && !U.isPersonCode(code) && state.direction === "OUT" && state.personCode) {
    if (!U.bool(params.ppeOverride)) {
      const ppe = await checkPpeCooldown({
        ...ctx,
        params: { personCode: state.personCode, itemCode: code },
      });
      if (ppe.applies && ppe.restricted) {
        return { error: "PPE_COOLDOWN", ...ppe };
      }
    }
  }

  const clientTs = U.num(params.clientTs, 0);
  const scannedAt = clientTs > 0 ? new Date(clientTs) : new Date();
  const rowDate = U.rowDateOf(scannedAt);

  await query(
    `INSERT INTO scans (tool_code, scanned_at, row_date, created_by, device_id, session_id, client_seq)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      code,
      scannedAt,
      rowDate,
      user.username,
      U.trimmed(params.deviceId),
      U.trimmed(params.sessionId),
      U.int(params.clientSeq, 0) || null,
    ]
  );

  custody.invalidate();
  return { status: "OK", code, scannedAt: scannedAt.toISOString(), rowDate };
}

module.exports = {
  LEASE_MS,
  acquireTerminalSession,
  heartbeatTerminalSession,
  releaseTerminalSession,
  resetTerminalSession,
  blockSession,
  checkScanCode,
  checkPpeCooldown,
  appendScan,
};
