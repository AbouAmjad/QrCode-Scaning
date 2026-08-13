const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { fail } = require("../lib/ctx");
const permissions = require("../permissions");
const U = require("../lib/util");

const MIN_PASSWORD = 6;

/** Absolute sole system admin — no other username may hold role=admin. */
const SOLE_ADMIN_USERNAME = "boss";

function isSoleAdminUsername(username) {
  return String(username || "").trim().toLowerCase() === SOLE_ADMIN_USERNAME;
}

/** Reject assigning admin to anyone except boss. */
function guardAdminRoleAssignment(username, role) {
  const r = permissions.normalizeRoleLocal(role);
  if (r !== "admin") return null;
  if (isSoleAdminUsername(username)) return null;
  return { success: false, error: "ONLY_BOSS_CAN_BE_ADMIN" };
}

/** Protect boss account from demotion / disable / delete. */
function guardSoleAdminMutation(target, { nextRole, active, deleting, rejecting } = {}) {
  if (!isSoleAdminUsername(target.username)) return null;
  if (deleting) return { success: false, error: "CANNOT_DELETE_SOLE_ADMIN" };
  if (rejecting) return { success: false, error: "CANNOT_MODIFY_SOLE_ADMIN" };
  if (nextRole !== undefined && permissions.normalizeRoleLocal(nextRole) !== "admin") {
    return { success: false, error: "CANNOT_DEMOTE_SOLE_ADMIN" };
  }
  if (active !== undefined && U.bool(active) === false) {
    return { success: false, error: "CANNOT_DISABLE_SOLE_ADMIN" };
  }
  return null;
}

function newToken() {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

function publicUser(row, scopes) {
  return {
    id: row.id,
    username: row.username,
    role: permissions.normalizeRoleLocal(row.role),
    fullName: row.full_name || "",
    phone: row.phone || "",
    email: row.email || "",
    avatarUrl: row.avatar_url || "",
    approvalStatus: row.approval_status || "approved",
    createdAt: U.isoOrNull(row.created_at),
    active: row.is_active !== false,
    scopes: scopes || { warehouseIds: [], projectIds: [] },
  };
}

async function scopesFor(query, userIds) {
  const out = new Map();
  userIds.forEach((id) => out.set(id, { warehouseIds: [], projectIds: [] }));
  if (!userIds.length) return out;
  const [w, p] = await Promise.all([
    query(`SELECT user_id, warehouse_id FROM user_warehouse_scope WHERE user_id = ANY($1::int[])`, [userIds]),
    query(`SELECT user_id, project_id FROM user_project_scope WHERE user_id = ANY($1::int[])`, [userIds]),
  ]);
  w.rows.forEach((r) => out.get(r.user_id) && out.get(r.user_id).warehouseIds.push(r.warehouse_id));
  p.rows.forEach((r) => out.get(r.user_id) && out.get(r.user_id).projectIds.push(r.project_id));
  return out;
}

async function replaceScopes(query, userId, table, column, ids) {
  await query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  for (const raw of ids) {
    const id = U.int(raw, 0);
    if (!id) continue;
    await query(
      `INSERT INTO ${table} (user_id, ${column}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, id]
    );
  }
}

async function findUser(query, username) {
  const r = await query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [
    U.trimmed(username),
  ]);
  return r.rows[0] || null;
}

/* ------------------------------------------------------------------ public */

async function login(ctx) {
  const { params, query } = ctx;
  const username = U.trimmed(params.user || params.username);
  const password = U.str(params.pass || params.password);
  if (!username || !password) return { success: false, error: "BAD_CREDENTIALS" };

  const u = await findUser(query, username);
  if (!u || !u.password_hash || !(await bcrypt.compare(password, u.password_hash))) {
    await ctx.audit({
      username,
      action: "LOGIN_FAILED",
      detail: "bad credentials",
      device: params.device || "",
    });
    return { success: false, error: "BAD_CREDENTIALS" };
  }
  if (u.is_active === false) return { success: false, error: "ACCOUNT_DISABLED" };
  if ((u.approval_status || "approved") === "pending") return { success: false, error: "PENDING_APPROVAL" };
  if ((u.approval_status || "approved") === "rejected") return { success: false, error: "ACCOUNT_REJECTED" };

  let token = u.api_token;
  if (!token) {
    token = newToken();
    await query(`UPDATE users SET api_token = $1 WHERE id = $2`, [token, u.id]);
  }

  const role = permissions.normalizeRoleLocal(u.role);
  const perms = await permissions.getPermissionsForRole(query, role);
  await ctx.audit({
    username: u.username,
    role,
    action: "LOGIN",
    detail: "success",
    device: params.device || "",
  });

  return {
    success: true,
    token,
    role,
    user: u.username,
    fullName: u.full_name || "",
    avatarUrl: u.avatar_url || "",
    permissions: perms,
  };
}

async function registerUser(ctx) {
  const { params, query } = ctx;
  const username = U.trimmed(params.username).toLowerCase();
  const password = U.str(params.password);
  if (!username) return { success: false, error: "USERNAME_REQUIRED" };
  if (password.length < MIN_PASSWORD) return { success: false, error: "PASSWORD_TOO_SHORT" };

  const existing = await findUser(query, username);
  if (existing) return { success: false, error: "USERNAME_TAKEN" };

  const regRole = permissions.normalizeRoleLocal(params.role);
  if (regRole === "worker" || String(params.role || "").trim().toLowerCase() === "worker") {
    return { success: false, error: "ROLE_WORKER_FORBIDDEN" };
  }
  const adminLock = guardAdminRoleAssignment(username, regRole);
  if (adminLock) return adminLock;
  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (username, password_hash, role, api_token, full_name, phone, email,
                        approval_status, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',TRUE)`,
    [
      username,
      hash,
      regRole,
      newToken(),
      U.trimmed(params.fullName),
      U.trimmed(params.phone),
      U.trimmed(params.email),
    ]
  );
  await ctx.audit({ username, action: "REGISTER", detail: "pending approval" });
  return { success: true, pending: true, username };
}

/* ------------------------------------------------------------------ admin */

async function listUsers(ctx) {
  ctx.require("users.manage");
  const r = await ctx.query(`SELECT * FROM users ORDER BY username ASC`);
  const scopes = await scopesFor(ctx.query, r.rows.map((x) => x.id));
  return { items: r.rows.map((row) => publicUser(row, scopes.get(row.id))) };
}

async function createUser(ctx) {
  ctx.require("users.manage");
  const { params, query } = ctx;
  const username = U.trimmed(params.username).toLowerCase();
  const password = U.str(params.password);
  if (!username) return { success: false, error: "USERNAME_REQUIRED" };
  if (password.length < MIN_PASSWORD) return { success: false, error: "PASSWORD_TOO_SHORT" };
  if (await findUser(query, username)) return { success: false, error: "USERNAME_TAKEN" };

  const role = permissions.normalizeRoleLocal(params.role);
  const adminLock = guardAdminRoleAssignment(username, role);
  if (adminLock) return adminLock;
  const hash = await bcrypt.hash(password, 10);
  const ins = await query(
    `INSERT INTO users (username, password_hash, role, api_token, full_name, phone, email,
                        approval_status, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',TRUE)
     RETURNING id`,
    [
      username,
      hash,
      role,
      newToken(),
      U.trimmed(params.fullName),
      U.trimmed(params.phone),
      U.trimmed(params.email),
    ]
  );
  const id = ins.rows[0].id;
  await replaceScopes(query, id, "user_warehouse_scope", "warehouse_id", U.asArray(params.warehouseIds));
  await replaceScopes(query, id, "user_project_scope", "project_id", U.asArray(params.projectIds));
  await ctx.audit({ action: "USER_CREATE", after: JSON.stringify({ username, role }) });
  return { success: true, username, role };
}

async function updateUser(ctx) {
  ctx.require("users.manage");
  const { params, query } = ctx;
  const target = await findUser(query, params.username);
  if (!target) return { success: false, error: "NOT_FOUND" };

  const requestedRole = params.newRole !== undefined ? params.newRole : params.role;
  const nextRole = requestedRole !== undefined && requestedRole !== ""
    ? permissions.normalizeRoleLocal(requestedRole)
    : undefined;
  if (nextRole !== undefined) {
    const adminLock = guardAdminRoleAssignment(target.username, nextRole);
    if (adminLock) return adminLock;
  }
  const soleGuard = guardSoleAdminMutation(target, {
    nextRole,
    active: params.active,
  });
  if (soleGuard) return soleGuard;

  const before = { role: target.role, active: target.is_active };
  const sets = [];
  const args = [];
  const push = (frag, value) => {
    args.push(value);
    sets.push(`${frag} = $${args.length}`);
  };

  if (nextRole !== undefined) push("role", nextRole);
  if (params.fullName !== undefined) push("full_name", U.trimmed(params.fullName));
  if (params.phone !== undefined) push("phone", U.trimmed(params.phone));
  if (params.email !== undefined) push("email", U.trimmed(params.email));
  if (params.active !== undefined) push("is_active", U.bool(params.active));
  if (params.approvalStatus !== undefined) push("approval_status", U.trimmed(params.approvalStatus));
  if (params.password !== undefined && U.str(params.password)) {
    const password = U.str(params.password);
    if (password.length < MIN_PASSWORD) return { success: false, error: "PASSWORD_TOO_SHORT" };
    push("password_hash", await bcrypt.hash(password, 10));
  }

  if (sets.length) {
    args.push(target.id);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${args.length}`, args);
  }
  if (params.warehouseIds !== undefined) {
    await replaceScopes(query, target.id, "user_warehouse_scope", "warehouse_id", U.asArray(params.warehouseIds));
  }
  if (params.projectIds !== undefined) {
    await replaceScopes(query, target.id, "user_project_scope", "project_id", U.asArray(params.projectIds));
  }

  const afterRole = nextRole !== undefined ? nextRole : target.role;
  await ctx.audit({
    action: "USER_UPDATE",
    before: JSON.stringify(before),
    after: JSON.stringify({
      username: target.username,
      role: afterRole,
      changed: sets.length,
    }),
  });
  return {
    success: true,
    username: target.username,
    role: permissions.normalizeRoleLocal(afterRole),
  };
}

async function deleteUser(ctx) {
  ctx.require("users.manage");
  const target = await findUser(ctx.query, ctx.params.username);
  if (!target) return { success: false, error: "NOT_FOUND" };
  if (String(target.username).toLowerCase() === String(ctx.user.username).toLowerCase()) {
    return { success: false, error: "CANNOT_DELETE_SELF" };
  }

  const soleGuard = guardSoleAdminMutation(target, { deleting: true });
  if (soleGuard) return soleGuard;

  const targetRole = permissions.normalizeRoleLocal(target.role);
  if (targetRole === "admin") {
    // Extra safety: never remove the last admin even if username drifts.
    const admins = await ctx.query(
      `SELECT COUNT(*)::int AS n FROM users
        WHERE lower(role) = 'admin'
          AND COALESCE(approval_status, 'approved') = 'approved'
          AND COALESCE(is_active, TRUE) = TRUE`
    );
    if ((admins.rows[0] && admins.rows[0].n) <= 1) {
      return { success: false, error: "CANNOT_DELETE_LAST_ADMIN" };
    }
  }

  try {
    await ctx.query(`DELETE FROM users WHERE id = $1`, [target.id]);
  } catch (e) {
    const msg = String((e && e.message) || e || "");
    if (/foreign key|violates/i.test(msg)) {
      return { success: false, error: "USER_HAS_LINKED_RECORDS", detail: msg.slice(0, 240) };
    }
    throw e;
  }
  await ctx.audit({ action: "USER_DELETE", before: JSON.stringify({ username: target.username, role: target.role }) });
  return { success: true, username: target.username };
}

async function approveUser(ctx) {
  ctx.require("users.manage");
  const { params, query } = ctx;
  const target = await findUser(query, params.username);
  if (!target) return { success: false, error: "NOT_FOUND" };
  const role = params.role ? permissions.normalizeRoleLocal(params.role) : permissions.normalizeRoleLocal(target.role);
  const adminLock = guardAdminRoleAssignment(target.username, role);
  if (adminLock) return adminLock;
  await query(
    `UPDATE users SET approval_status = 'approved', is_active = TRUE, role = $1 WHERE id = $2`,
    [role, target.id]
  );
  await ctx.audit({ action: "USER_APPROVE", after: JSON.stringify({ username: target.username, role }) });
  return { success: true, username: target.username, role };
}

async function rejectUser(ctx) {
  ctx.require("users.manage");
  const target = await findUser(ctx.query, ctx.params.username);
  if (!target) return { success: false, error: "NOT_FOUND" };
  const soleGuard = guardSoleAdminMutation(target, { rejecting: true });
  if (soleGuard) return soleGuard;
  await ctx.query(
    `UPDATE users SET approval_status = 'rejected', is_active = FALSE WHERE id = $1`,
    [target.id]
  );
  await ctx.audit({ action: "USER_REJECT", after: JSON.stringify({ username: target.username }) });
  return { success: true, username: target.username };
}

/* ------------------------------------------------------------ permissions */

async function listPermissions(ctx) {
  ctx.require("roles.manage");
  const roles = {};
  for (const role of permissions.ALL_ROLES) {
    roles[role] = await permissions.getPermissionsForRole(ctx.query, role);
  }
  return {
    items: permissions.PERMISSIONS,
    roles,
    roleMeta: permissions.ROLE_META,
    editableRoles: permissions.EDITABLE_ROLES,
  };
}

async function setRolePermissions(ctx) {
  ctx.require("roles.manage");
  const { params, query } = ctx;
  const role = permissions.normalizeRoleLocal(params.role);
  if (role === "admin") return { success: false, error: "ADMIN_ROLE_LOCKED" };
  if (!permissions.EDITABLE_ROLES.includes(role)) return { success: false, error: "UNKNOWN_ROLE" };

  const valid = new Set(permissions.PERMISSIONS.map((p) => p.code));
  const codes = U.uniq(U.asArray(params.permissions).map((c) => U.trimmed(c)).filter((c) => valid.has(c)));

  const before = await permissions.getPermissionsForRole(query, role);
  await query(`DELETE FROM role_permissions WHERE role = $1`, [role]);
  for (const code of codes) {
    await query(
      `INSERT INTO role_permissions (role, permission_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [role, code]
    );
  }
  await ctx.audit({
    action: "ROLE_PERMISSIONS_SET",
    before: JSON.stringify(before),
    after: JSON.stringify(codes),
    detail: role,
  });
  return { success: true, role, permissions: codes };
}

async function getMyPermissions(ctx) {
  return {
    success: true,
    user: ctx.user.username,
    role: ctx.role,
    permissions: ctx.perms,
    roleMeta: permissions.ROLE_META[ctx.role] || null,
  };
}

/* --------------------------------------------------------------- profile */

async function getMyProfile(ctx) {
  const r = await ctx.query(`SELECT * FROM users WHERE id = $1`, [ctx.user.id]);
  const u = r.rows[0];
  if (!u) fail("NOT_FOUND");
  return {
    success: true,
    username: u.username,
    fullName: u.full_name || "",
    phone: u.phone || "",
    email: u.email || "",
    avatarUrl: u.avatar_url || "",
    role: permissions.normalizeRoleLocal(u.role),
    createdAt: U.isoOrNull(u.created_at),
  };
}

async function updateMyProfile(ctx) {
  const { params, query, user } = ctx;
  let avatarUrl = user.avatar_url || "";

  if (U.bool(params.clearAvatar)) {
    U.removeUpload(avatarUrl);
    avatarUrl = "";
  } else if (U.trimmed(params.avatarBase64)) {
    try {
      const next = U.saveDataUrl(params.avatarBase64, `avatar_${user.username}`);
      U.removeUpload(avatarUrl);
      avatarUrl = next;
    } catch (e) {
      return { success: false, error: "IMAGE_FAILED" };
    }
  }

  await query(
    `UPDATE users SET full_name = $1, phone = $2, email = $3, avatar_url = $4 WHERE id = $5`,
    [
      U.trimmed(params.fullName),
      U.trimmed(params.phone),
      U.trimmed(params.email),
      avatarUrl,
      user.id,
    ]
  );
  await ctx.audit({ action: "PROFILE_UPDATE" });
  return {
    success: true,
    fullName: U.trimmed(params.fullName),
    phone: U.trimmed(params.phone),
    email: U.trimmed(params.email),
    avatarUrl,
  };
}

async function changeMyPassword(ctx) {
  const { params, query, user } = ctx;
  const current = U.str(params.currentPassword);
  const next = U.str(params.newPassword);
  if (next.length < MIN_PASSWORD) return { success: false, error: "PASSWORD_TOO_SHORT" };
  if (!(await bcrypt.compare(current, user.password_hash || ""))) {
    return { success: false, error: "WRONG_PASSWORD" };
  }
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    await bcrypt.hash(next, 10),
    user.id,
  ]);
  await ctx.audit({ action: "PASSWORD_CHANGE" });
  return { success: true };
}

module.exports = {
  __public: ["login", "registerUser"],
  login,
  registerUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
  listPermissions,
  setRolePermissions,
  getMyPermissions,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
};
