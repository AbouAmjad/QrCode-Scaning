require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { query } = require("./db");
const permissions = require("./permissions");
const custody = require("./custody");
const { ensureSchema } = require("./schema");
const { ApiError } = require("./lib/ctx");
const U = require("./lib/util");

const auth = require("./handlers/auth");
const people = require("./handlers/people");
const catalog = require("./handlers/catalog");
const inventory = require("./handlers/inventory");
const warehouses = require("./handlers/warehouses");
const projects = require("./handlers/projects");
const terminal = require("./handlers/terminal");
const qc = require("./handlers/qc");
const requests = require("./handlers/requests");
const logs = require("./handlers/logs");

const PORT = Number(process.env.PORT || 3000);

/* --------------------------------------------------------- action table */

const ACTIONS = {
  /* auth + users */
  login: auth.login,
  registerUser: auth.registerUser,
  listUsers: auth.listUsers,
  createUser: auth.createUser,
  updateUser: auth.updateUser,
  deleteUser: auth.deleteUser,
  approveUser: auth.approveUser,
  rejectUser: auth.rejectUser,
  listPermissions: auth.listPermissions,
  setRolePermissions: auth.setRolePermissions,
  getMyPermissions: auth.getMyPermissions,
  getMyProfile: auth.getMyProfile,
  updateMyProfile: auth.updateMyProfile,
  changeMyPassword: auth.changeMyPassword,

  /* people + suppliers */
  listPeople: people.listPeople,
  getPersonCustody: people.getPersonCustody,
  upsertPerson: people.upsertPerson,
  deletePerson: people.deletePerson,
  setPersonIdImage: people.setPersonIdImage,
  clearPersonIdImage: people.clearPersonIdImage,
  listSuppliers: people.listSuppliers,
  upsertSupplier: people.upsertSupplier,
  deleteSupplier: people.deleteSupplier,

  /* catalog + products + labels */
  getCatalogStock: catalog.getCatalogStock,
  getDesc: catalog.getDesc,
  checkCatalogCode: catalog.checkCatalogCode,
  getLastCodes: catalog.getLastCodes,
  upsertProduct: catalog.upsertProduct,
  deleteProduct: catalog.deleteProduct,
  bulkUpsertProducts: catalog.bulkUpsertProducts,
  setProductImage: catalog.setProductImage,
  getProductImages: catalog.getProductImages,
  clearProductImage: catalog.clearProductImage,
  listCategories: catalog.listCategories,
  upsertCategory: catalog.upsertCategory,
  upsertSubcategory: catalog.upsertSubcategory,
  upsertCatalogItem: catalog.upsertCatalogItem,
  deleteCategory: catalog.deleteCategory,
  deleteSubcategory: catalog.deleteSubcategory,
  deleteCatalogItem: catalog.deleteCatalogItem,
  listLabelTemplates: catalog.listLabelTemplates,
  saveLabelTemplate: catalog.saveLabelTemplate,
  deleteLabelTemplate: catalog.deleteLabelTemplate,

  /* custody + inventory */
  getOutstanding: inventory.getOutstanding,
  lookupToolHolder: inventory.lookupToolHolder,
  getInventoryDashboard: inventory.getInventoryDashboard,
  getReceiving: inventory.getReceiving,
  receiveItem: inventory.receiveItem,
  getDamage: inventory.getDamage,
  getDamageDates: inventory.getDamageDates,
  submitDamage: inventory.submitDamage,
  setLifecycle: inventory.setLifecycle,
  getLifecycle: inventory.getLifecycle,

  /* warehouses */
  listWarehouses: warehouses.listWarehouses,
  createWarehouse: warehouses.createWarehouse,
  deleteWarehouse: warehouses.deleteWarehouse,
  listWarehouseStock: warehouses.listWarehouseStock,
  listWarehouseTransfers: warehouses.listWarehouseTransfers,
  getWarehouseTransfer: warehouses.getWarehouseTransfer,
  createWarehouseTransfer: warehouses.createWarehouseTransfer,
  createInventoryCountSheet: warehouses.createInventoryCountSheet,

  /* projects */
  listProjects: projects.listProjects,
  getProject: projects.getProject,
  upsertProject: projects.upsertProject,
  deleteProject: projects.deleteProject,
  getProjectDispatch: projects.getProjectDispatch,
  createProjectDispatch: projects.createProjectDispatch,
  returnProjectTools: projects.returnProjectTools,
  updateProjectDispatch: projects.updateProjectDispatch,
  deleteProjectDispatch: projects.deleteProjectDispatch,

  /* terminal */
  acquireTerminalSession: terminal.acquireTerminalSession,
  heartbeatTerminalSession: terminal.heartbeatTerminalSession,
  releaseTerminalSession: terminal.releaseTerminalSession,
  resetTerminalSession: terminal.resetTerminalSession,
  checkScanCode: terminal.checkScanCode,
  // Historical misspelling — the deployed frontend calls it exactly like this.
  checkPpeCooldownoldown: terminal.checkPpeCooldown,
  checkPpeCooldown: terminal.checkPpeCooldown,

  /* QC */
  listQcItems: qc.listQcItems,
  recordCalibration: qc.recordCalibration,

  /* store requests */
  getStoreRequests: requests.getStoreRequests,
  createStoreRequest: requests.createStoreRequest,
  cancelStoreRequest: requests.cancelStoreRequest,
  deleteStoreRequest: requests.deleteStoreRequest,

  /* logs + audit */
  getDates: logs.getDates,
  getData: logs.getData,
  getScanLog: logs.getScanLog,
  searchAll: logs.searchAll,
  auditLog: logs.auditLog,
  getAuditLog: logs.getAuditLog,
};

/** Reachable without a token. */
const PUBLIC_ACTIONS = new Set(["login", "registerUser", "options"]);

/* -------------------------------------------------------------- plumbing */

/** Query string and body are merged so GET and POST share one contract. */
function mergeParams(req) {
  let body = req.body;
  if (typeof body === "string" && body.trim()) {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return { ...(req.query || {}), ...(body || {}) };
}

function normalizeRole(role) {
  return permissions.normalizeRoleLocal(role);
}

async function findUserByToken(token) {
  const t = U.trimmed(token);
  if (!t) return null;
  const r = await query(`SELECT * FROM users WHERE api_token = $1 LIMIT 1`, [t]);
  return r.rows[0] || null;
}

async function appendAudit(entry) {
  try {
    await query(
      `INSERT INTO audit_log (username, role, action, before_state, after_state, detail, device)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        entry.username || "",
        entry.role || "",
        entry.action || "",
        entry.before || "",
        entry.after || "",
        entry.detail || "",
        entry.device || "",
      ]
    );
  } catch (e) {
    console.warn("[audit]", (e && e.message) || e);
  }
}

function buildContext(params, user, perms) {
  const role = user ? normalizeRole(user.role) : "";
  let ledgerPromise = null;

  const ctx = {
    params,
    query,
    user,
    role,
    perms,
    custody,
    can(code) {
      if (role === "admin") return true;
      return permissions.hasPermission(perms, code);
    },
    canAny(codes) {
      if (role === "admin") return true;
      return permissions.hasAnyPermission(perms, codes);
    },
    require(code) {
      if (!ctx.can(code)) throw new ApiError("FORBIDDEN", { permission: code });
      return true;
    },
    requireAny(codes) {
      if (!ctx.canAny(codes)) throw new ApiError("FORBIDDEN", { permission: codes.join("|") });
      return true;
    },
    ledger() {
      if (!ledgerPromise) ledgerPromise = custody.load(query);
      return ledgerPromise;
    },
    audit(entry) {
      return appendAudit({
        username: user ? user.username : "",
        role,
        device: U.str(params.device),
        ...entry,
      });
    },
  };
  return ctx;
}

async function route(params) {
  const action = U.trimmed(params.action);

  if (action === "options") return { ok: true };

  if (PUBLIC_ACTIONS.has(action)) {
    const ctx = buildContext(params, null, []);
    return ACTIONS[action](ctx);
  }

  const user = await findUserByToken(params.token);
  if (!user) return { error: "UNAUTHORIZED" };
  if (user.is_active === false) return { error: "ACCOUNT_DISABLED" };

  const role = normalizeRole(user.role);
  const perms = await permissions.getPermissionsForRole(query, role);
  const ctx = buildContext(params, user, perms);

  // Bare scan payload (no action) is the terminal's append path.
  if (!action && params.scanData !== undefined) {
    return terminal.appendScan(ctx);
  }

  const fn = ACTIONS[action];
  if (!fn) return { error: "NO ACTION SPECIFIED", action: action || "" };
  return fn(ctx);
}

async function handle(params) {
  try {
    return await route(params);
  } catch (e) {
    if (e instanceof ApiError) return e.toJSON();
    throw e;
  }
}

async function dispatch(req, res) {
  try {
    const result = await handle(mergeParams(req));
    res.type("application/json").send(JSON.stringify(result === undefined ? {} : result));
  } catch (e) {
    if (e instanceof ApiError) {
      res.type("application/json").send(JSON.stringify(e.toJSON()));
      return;
    }
    console.error("[api]", e);
    res
      .status(500)
      .type("application/json")
      .send(JSON.stringify({ error: (e && e.message) || "SERVER_ERROR" }));
  }
}

/* ------------------------------------------------------------------ app */

const app = express();
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json({ limit: "25mb" }));
app.use(express.text({ type: ["text/plain", "application/json"], limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "toolcustody-api", actions: Object.keys(ACTIONS).length })
);

app.get("/", dispatch);
app.post("/", dispatch);
app.get("/api", dispatch);
app.post("/api", dispatch);
app.get("/api/exec", dispatch);
app.post("/api/exec", dispatch);

async function start() {
  U.ensureUploadDir();
  await ensureSchema(query);
  try {
    await permissions.seedPermissions(query);
  } catch (e) {
    console.warn("[permissions] seed skipped:", (e && e.message) || e);
  }
  app.listen(PORT, () => {
    console.log(`ToolCustody API on :${PORT} · ${Object.keys(ACTIONS).length} actions`);
  });
}

if (require.main === module) {
  start().catch((e) => {
    console.error("Fatal boot error:", e);
    process.exit(1);
  });
}

module.exports = { app, handle, ACTIONS, mergeParams, normalizeRole, start };
