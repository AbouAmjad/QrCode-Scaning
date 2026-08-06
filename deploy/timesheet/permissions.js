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
  { code: "qc.manage", module: "Quality Control", label: "Record calibrations" },
  { code: "timesheet.scan", module: "Timesheet", label: "Attendance scan (punch)" },
  { code: "timesheet.attendance.read", module: "Timesheet", label: "View attendance lists" },
  { code: "timesheet.attendance.void", module: "Timesheet", label: "Void attendance punch" },
  { code: "timesheet.hours.adjust", module: "Timesheet", label: "Add/subtract hours" },
  { code: "timesheet.deductions.manage", module: "Timesheet", label: "Manage deductions" },
  { code: "timesheet.settings.manage", module: "Timesheet", label: "Shift hours settings" },
  { code: "timesheet.worker_accounts.manage", module: "Timesheet", label: "Link worker logins" },
  { code: "timesheet.workers.manage", module: "Timesheet", label: "Manage timesheet workers" },
  { code: "timesheet.portal.self", module: "Timesheet", label: "Worker self portal" },
  { code: "timesheet.reports.read", module: "Timesheet", label: "View timesheet reports" },
  { code: "timesheet.notifications.read", module: "Timesheet", label: "View timesheet notifications" }
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
  storekeeper: {
    department: "Warehouse",
    title: "Storekeeper",
    summary: "Attendance scan · view timesheet · terminal basics"
  },
  supervisor: {
    department: "Operations",
    title: "Supervisor",
    summary: "Attendance · hours · deductions · reports"
  },
  viewer: {
    department: "Operations",
    title: "Viewer",
    summary: "Read-only timesheet · reports"
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
  },
  worker: {
    department: "Workforce",
    title: "Worker",
    summary: "Timesheet portal · own attendance & custody"
  }
};

/**
 * Suggested defaults for a fresh install (seeded once when role_permissions is empty).
 * After seeding, admins adjust matrices in the Roles UI without restart wiping them.
 */
const DEFAULT_ROLE_PERMISSIONS = {
  employee: [
    "dashboard.view", "terminal.use", "tool.view", "tool.create", "tool.edit", "tool.delete",
    "tool.checkout", "tool.return", "tool.receive", "tool.search",
    "worker.view", "worker.create", "worker.edit", "worker.delete",
    "inventory.view", "inventory.count", "inventory.adjust", "inventory.transfer",
    "damage.create", "damage.review", "consumables.manage", "request.approve",
    "forms.view", "reports.warehouse", "logs.view",
    "timesheet.scan", "timesheet.attendance.read"
  ],
  storekeeper: [
    "dashboard.view", "terminal.use", "tool.view", "tool.search",
    "timesheet.scan", "timesheet.attendance.read", "timesheet.reports.read", "timesheet.notifications.read"
  ],
  supervisor: [
    "dashboard.view", "projects.view", "worker.view",
    "timesheet.attendance.read", "timesheet.attendance.void", "timesheet.hours.adjust",
    "timesheet.deductions.manage", "timesheet.settings.manage",
    "timesheet.workers.manage", "timesheet.worker_accounts.manage",
    "timesheet.reports.read", "timesheet.notifications.read"
  ],
  viewer: [
    "dashboard.view",
    "timesheet.attendance.read", "timesheet.reports.read", "timesheet.notifications.read"
  ],
  worker: [
    "timesheet.portal.self"
  ],
  logistics: [
    "dashboard.view", "projects.view", "projects.manage", "projects.dispatch", "projects.return",
    "tool.view", "tool.search", "tool.return", "worker.view", "forms.view", "reports.team"
  ],
  engineer: [
    "dashboard.view", "tool.view", "tool.search", "worker.view", "request.create",
    "consumables.manage", "projects.view", "forms.view", "damage.create", "inventory.view"
  ],
  qc: ["dashboard.view", "qc.view", "qc.manage", "tool.view"]
};

/** @deprecated use DEFAULT_ROLE_PERMISSIONS — kept for explicit resetRoles seeding */
const ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((p) => p.code),
  employee: DEFAULT_ROLE_PERMISSIONS.employee,
  storekeeper: DEFAULT_ROLE_PERMISSIONS.storekeeper,
  supervisor: DEFAULT_ROLE_PERMISSIONS.supervisor,
  viewer: DEFAULT_ROLE_PERMISSIONS.viewer,
  logistics: DEFAULT_ROLE_PERMISSIONS.logistics,
  engineer: DEFAULT_ROLE_PERMISSIONS.engineer,
  qc: DEFAULT_ROLE_PERMISSIONS.qc,
  worker: DEFAULT_ROLE_PERMISSIONS.worker || ["timesheet.portal.self"]
};

const EDITABLE_ROLES = ["employee", "storekeeper", "supervisor", "viewer", "logistics", "engineer", "qc", "worker"];
const ALL_ROLES = ["admin", "employee", "storekeeper", "supervisor", "viewer", "logistics", "engineer", "qc", "worker"];

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
  } else {
    const existing = await query(`SELECT COUNT(*)::int AS n FROM role_permissions`);
    if (existing.rows[0].n === 0) {
      for (const role of EDITABLE_ROLES) {
        const codes = DEFAULT_ROLE_PERMISSIONS[role] || [];
        for (const code of codes) {
          await query(
            `INSERT INTO role_permissions (role, permission_code)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [role, code]
          );
        }
      }
    } else {
      // Additive: seed brand-new roles only when they have zero rows (never wipe existing matrices)
      for (const role of ["storekeeper", "supervisor", "viewer"]) {
        const n = await query(`SELECT COUNT(*)::int AS n FROM role_permissions WHERE role = $1`, [role]);
        if (n.rows[0].n > 0) continue;
        const codes = DEFAULT_ROLE_PERMISSIONS[role] || [];
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
    store_keeper: "storekeeper",
    storekeeper: "storekeeper",
    warehouse: "employee",
    staff: "employee",
    logistics: "logistics",
    logistic: "logistics",
    transport: "logistics",
    dispatch: "logistics",
    engineer: "engineer",
    supervisor: "supervisor",
    viewer: "viewer",
    admin: "admin",
    administrator: "admin",
    qc: "qc",
    quality: "qc",
    quality_control: "qc",
    "quality-control": "qc",
    worker: "worker",
    labour: "worker",
    labor: "worker"
  };
  if (map[raw]) return map[raw];
  if (ALL_ROLES.includes(raw)) return raw;
  return "employee";
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
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_META,
  EDITABLE_ROLES,
  ALL_ROLES,
  seedPermissions,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  normalizeRoleLocal
};
