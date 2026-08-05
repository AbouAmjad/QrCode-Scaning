const { query } = require("../db");

async function logTimesheetAudit({
  username,
  role,
  action,
  entityType = "",
  entityId = "",
  before = "",
  after = "",
  detail = "",
  device = "",
}) {
  await query(
    `INSERT INTO ts_audit_log
      (username, role, action, entity_type, entity_id, before_state, after_state, detail, device)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      username || "",
      role || "",
      action || "",
      entityType,
      String(entityId || ""),
      before || "",
      after || "",
      detail || "",
      device || "",
    ]
  );
}

module.exports = { logTimesheetAudit };
