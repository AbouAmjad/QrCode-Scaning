/**
 * Enterprise permission catalog + default role matrices.
 * Roles = departments:
 *   admin     → System Admin
 *   employee  → Warehouse / Store Keeper
 *   logistics → Logistics / Transport
 *   engineer  → Engineering / Field
 *   qc        → Quality Control
 */
const PERMISSIONS = [
  { code: "dashboard.view", module: "Dashboard", label: "View dashboard" },
  { code: "dashboard.full", module: "Dashboard", label: "Full KPIs / all widgets" },
  { code: "terminal.use", module: "Warehouse Terminal", label: "QR checkout / return terminal" },
  { code: "tool.view", module: "Catalog", label: "View products / tools" },
  { code: "tool.create", module: "Catalog", label: "Create products" },
  { code: "tool.edit", module: "Catalog", label: "Edit products / photos / QR" },
  { code: "tool.delete", module: "Catalog", label: "Delete products" },
  { code: "tool.checkout", module: "Warehouse Terminal", label: "Checkout tools (OUT)" },
  { code: "tool.return", module: "Warehouse Terminal", label: "Return tools (IN) / outstanding" },
  { code: "tool.receive", module: "Receiving", label: "Receive new stock" },
  { code: "tool.search", module: "Search", label: "Search tools & people" },
  { code: "worker.view", module: "People", label: "View people" },
  { code: "worker.create", module: "People", label: "Create people" },
  { code: "worker.edit", module: "People", label: "Edit people" },
  { code: "worker.delete", module: "People", label: "Delete people" },
  { code: "inventory.view", module: "Inventory", label: "View inventory" },
  { code: "inventory.count", module: "Inventory", label: "Inventory count" },
  { code: "inventory.adjust", module: "Inventory", label: "Inventory adjustment" },
  { code: "inventory.transfer", module: "Inventory", label: "Warehouse transfer" },
  { code: "damage.create", module: "Damage", label: "Create damage report" },
  { code: "damage.review", module: "Damage", label: "Review damage reports" },
  { code: "damage.approve", module: "Damage", label: "Approve / reject damage" },
  { code: "repair.create", module: "Repair", label: "Request / send repair" },
  { code: "repair.manage", module: "Repair", label: "Manage repair / scrap" },
  { code: "consumables.manage", module: "Consumables", label: "Manage consumables usage" },
  { code: "request.create", module: "Requests", label: "Create store request" },
  { code: "request.approve", module: "Requests", label: "Approve store requests" },
  { code: "forms.view", module: "Forms", label: "Open printable forms (backcharge, equipment damage…)" },
  { code: "reports.warehouse", module: "Reports", label: "Warehouse reports" },
  { code: "reports.team", module: "Reports", label: "Team / field reports" },
  { code: "reports.all", module: "Reports", label: "All reports" },
  { code: "logs.view", module: "Logs", label: "View scan log" },
  { code: "users.manage", module: "Admin", label: "Manage users" },
  { code: "roles.manage", module: "Admin", label: "Manage roles & permissions" },
  { code: "settings.manage", module: "Admin", label: "System settings" },
  { code: "audit.view", module: "Admin", label: "View audit log" },
  { code: "projects.view", module: "Projects / Logistics", label: "View projects & on-site stock" },
  { code: "projects.manage", module: "Projects / Logistics", label: "Create / edit / delete projects" },
  { code: "projects.dispatch", module: "Projects / Logistics", label: "Dispatch tools to projects" },
  { code: "projects.return", module: "Projects / Logistics", label: "Return tools from projects" },
  { code: "qc.view", module: "Quality Control", label: "View QC / calibration" },
  { code: "qc.manage", module: "Quality Control", label: "Record calibrations" }
];

/** Department metadata for UI */
const ROLE_META = {
  admin: {
    department: "IT / Admin",
    title: "System Admin",
    summary: "Full system access · users · roles · settings"
  },
  employee: {
    department: "Warehouse",
    title: "Store Keeper",
    summary: "Stock · receiving · checkout · people · inventory · labels"
  },
  logistics: {
    department: "Logistics",
    title: "Transport / Dispatch",
    summary: "Project dispatch & return · site delivery"
  },
  engineer: {
    department: "Engineering",
    title: "Field Engineer",
    summary: "Requests · consumables · view stock & projects"
  },
  qc: {
    department: "Quality",
    title: "Quality Control",
    summary: "Calibration & QC records"
  }
};

/**
 * Default matrices — EMPTY for non-admin (admin assigns in Roles UI).
 * Admin is always full access in code.
 */
const ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((p) => p.code),
  employee: [],
  logistics: [],
  engineer: [],
  qc: []
};

const EDITABLE_ROLES = ["employee", "logistics", "engineer", "qc"];
const ALL_ROLES = ["admin", "employee", "logistics", "engineer", "qc"];

/**
 * Upsert permission catalog.
 * Role matrices are ONLY cleared/reset when opts.resetRoles === true
 * (so manual Roles UI changes are not wiped on restart/deploy).
 */
async function seedPermissions(query, opts = {}) {
  for (const p of PERMISSIONS) {
    await query(
      `INSERT INTO permissions (code, module, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label`,
      [p.code, p.module, p.label]
    );
  }

  if (opts.resetRoles === true) {
    for (const role of EDITABLE_ROLES) {
      await query(`DELETE FROM role_permissions WHERE role = $1`, [role]);
      const codes = ROLE_PERMISSIONS[role] || [];
      for (const code of codes) {
        await query(
          `INSERT INTO role_permissions (role, permission_code)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [role, code]
        );
      }
    }
  }
}

async function getPermissionsForRole(query, role) {
  const r = normalizeRoleLocal(role);
  if (r === "admin") return PERMISSIONS.map((p) => p.code);
  const res = await query(
    `SELECT permission_code FROM role_permissions WHERE role = $1 ORDER BY permission_code`,
    [r]
  );
  if (res.rows.length) return res.rows.map((x) => x.permission_code);
  // No DB rows = zero permissions (do not invent defaults)
  return [];
}

function normalizeRoleLocal(role) {
  const raw = String(role || "").trim().toLowerCase();
  const map = {
    employee: "employee",
    store_keeper: "employee",
    storekeeper: "employee",
    warehouse: "employee",
    staff: "employee",
    logistics: "logistics",
    logistic: "logistics",
    transport: "logistics",
    dispatch: "logistics",
    engineer: "engineer",
    supervisor: "engineer",
    viewer: "engineer",
    admin: "admin",
    administrator: "admin",
    qc: "qc",
    quality: "qc",
    quality_control: "qc",
    "quality-control": "qc"
  };
  return map[raw] || "employee";
}

function hasPermission(permList, code) {
  if (!code) return true;
  const list = Array.isArray(permList) ? permList : [];
  if (list.includes("*")) return true;
  return list.includes(code);
}

function hasAnyPermission(permList, codes) {
  if (!codes || !codes.length) return true;
  return codes.some((c) => hasPermission(permList, c));
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_META,
  EDITABLE_ROLES,
  ALL_ROLES,
  seedPermissions,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  normalizeRoleLocal
};
