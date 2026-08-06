/** إعدادات مشتركة — AbouAmjad Store System (VPS + PostgreSQL) */
const AppConfig = {
  SCRIPT_URL: (typeof location !== "undefined" && location.protocol && location.protocol !== "file:")
    ? (location.origin + "/api")
    : "https://aics.iskndr.com/api",
  TOKEN_KEY: "token",
  ROLE_KEY: "tc_role",
  USER_KEY: "tc_user",
  PERMS_KEY: "tc_permissions",
  AVATAR_KEY: "tc_avatar",
  FULLNAME_KEY: "tc_fullname",
  THEME_KEY: "uiTheme",
  THEME_COLOR_LIGHT: "#0f766e",
  THEME_COLOR_DARK: "#0b1220",
  SESSION_TOKEN: "",
  TOOL_PREFIXES: ["I", "E", "C", "B"],
  OVERDUE_DAYS: 1,
  /** PPE re-issue cooldown (gloves / safety glasses) */
  PPE_COOLDOWN_DAYS: 7,
  PPE_RULES: [
    {
      id: "gloves",
      label: "Gloves",
      // Codes C12-* + English/Arabic names
      pattern: "glove|gloves|قفاز|قفازات|^c12([-a-z0-9]|$)"
    },
    {
      id: "glasses",
      label: "Safety glasses",
      // Catalog uses "SAFTEY SUNGLASS" (typo) — match sunglass/saftey too
      pattern: "goggle|goggles|glasses|sunglass|sunglasses|saftey|eye\\s*protect|safety\\s*glass|نظارة|نظارات|^c13([-a-z0-9]|$)"
    }
  ],
  DASHBOARD_REFRESH_MS: 30000,
  /** employee = Warehouse · logistics · engineer · qc · admin */
  ROLES: ["employee", "storekeeper", "supervisor", "viewer", "safety", "store_manager", "coo", "project_manager", "project_engineer", "logistics", "engineer", "qc", "admin", "worker"],
  ROLE_RANK: { worker: 0, viewer: 1, storekeeper: 1, employee: 1, safety: 2, store_manager: 2, coo: 2, project_manager: 2, project_engineer: 2, logistics: 2, engineer: 2, supervisor: 2, qc: 2, admin: 3 },
  ROLE_HOME: {
    employee: "index.html",
    storekeeper: "timesheet-scan.html",
    supervisor: "timesheet-admin.html",
    viewer: "timesheet-admin.html",
    safety: "damage.html",
    store_manager: "dashboard.html",
    coo: "dashboard.html",
    project_manager: "warehouses.html#projects",
    project_engineer: "warehouses.html#projects",
    logistics: "projects.html",
    engineer: "consumables.html",
    qc: "qc.html",
    admin: "dashboard.html",
    worker: "timesheet-portal.html"
  },
  ROLE_LABELS: {
    employee: "Warehouse · Store Keeper",
    storekeeper: "Storekeeper",
    supervisor: "Supervisor",
    viewer: "Viewer",
    safety: "Safety",
    store_manager: "Store Manager",
    coo: "COO",
    project_manager: "Project Manager",
    project_engineer: "Project Engineer",
    logistics: "Logistics · Transport",
    engineer: "Engineering · Field",
    qc: "Quality Control",
    admin: "System Admin / Admin",
    worker: "Labor / Worker"
  },
  /**
   * Page access = ANY of these permissions (from the role matrix you set).
   * Pages NOT listed here are DENIED for non-admins (safe default for new sections).
   */
  PAGE_PERMISSIONS: {
    terminal: ["terminal.use"],
    outstanding: ["tool.return"],
    receiving: ["tool.receive"],
    damage: ["damage.create", "damage.review", "damage.approve"],
    logs: ["logs.view"],
    products: ["tool.view", "tool.create", "tool.edit", "tool.delete", "tool.receive"],
    categories: ["tool.create", "tool.edit", "tool.delete"],
    people: ["worker.view", "worker.create", "worker.edit", "worker.delete"],
    suppliers: ["worker.view", "worker.create", "worker.edit", "tool.receive"],
    consumables: ["consumables.manage"],
    labels: ["tool.edit", "tool.create"],
    requests: ["request.create", "request.approve"],
    forms: ["forms.view"],
    inventoryCount: ["inventory.count"],
    warehouses: ["inventory.view", "inventory.count", "inventory.transfer", "projects.manage"],
    warehouseTransfer: ["inventory.transfer"],
    projects: ["projects.view", "projects.manage", "projects.dispatch", "projects.return"],
    repair: ["repair.create", "repair.manage"],
    qc: ["qc.view", "qc.manage"],
    dashboard: ["dashboard.view", "dashboard.full"],
    audit: ["audit.view"],
    users: ["users.manage"],
    roles: ["roles.manage"],
    settings: ["settings.manage", "users.manage", "roles.manage"],
    timesheetScan: ["timesheet.scan"],
    timesheetAdmin: ["timesheet.attendance.read", "timesheet.reports.read", "timesheet.attendance.void", "timesheet.hours.adjust", "timesheet.deductions.manage", "timesheet.settings.manage", "timesheet.worker_accounts.manage", "timesheet.workers.manage"],
    timesheetPortal: ["timesheet.portal.self"]
  },
  /** Home page only — NOT used to unlock menu items */
  ROLE_PAGES: {
    employee: ["terminal"],
    storekeeper: ["timesheetScan", "timesheetAdmin", "terminal", "profile"],
    supervisor: ["timesheetAdmin", "timesheetScan", "projects", "profile"],
    viewer: ["timesheetAdmin", "profile"],
    safety: ["damage", "forms", "dashboard", "timesheetAdmin", "profile"],
    store_manager: ["dashboard", "terminal", "receiving", "products", "people", "requests", "forms", "inventoryCount", "warehouses", "warehouseTransfer", "damage", "logs", "timesheetScan", "timesheetAdmin", "profile"],
    coo: ["dashboard", "projects", "warehouses", "damage", "logs", "forms", "timesheetAdmin", "profile"],
    project_manager: ["projects", "forms", "dashboard", "timesheetAdmin", "profile"],
    project_engineer: ["projects", "forms", "dashboard", "consumables", "timesheetAdmin", "profile"],
    logistics: ["projects", "forms", "dashboard", "damage", "profile"],
    engineer: ["consumables"],
    qc: ["qc"],
    admin: ["*"],
    worker: ["timesheetPortal", "profile"]
  },
  ROLE_OPTIONS: [
    { value: "admin", labelKey: "role_admin", descKey: "role_admin_desc" },
    { value: "supervisor", labelKey: "role_supervisor", descKey: "role_supervisor_desc" },
    { value: "storekeeper", labelKey: "role_storekeeper", descKey: "role_storekeeper_desc" },
    { value: "employee", labelKey: "role_employee", descKey: "role_employee_desc" },
    { value: "viewer", labelKey: "role_viewer", descKey: "role_viewer_desc" },
    { value: "safety", labelKey: "role_safety", descKey: "role_safety_desc" },
    { value: "store_manager", labelKey: "role_store_manager", descKey: "role_store_manager_desc" },
    { value: "coo", labelKey: "role_coo", descKey: "role_coo_desc" },
    { value: "project_manager", labelKey: "role_project_manager", descKey: "role_project_manager_desc" },
    { value: "project_engineer", labelKey: "role_project_engineer", descKey: "role_project_engineer_desc" },
    { value: "logistics", labelKey: "role_logistics", descKey: "role_logistics_desc" },
    { value: "engineer", labelKey: "role_engineer", descKey: "role_engineer_desc" },
    { value: "qc", labelKey: "role_qc", descKey: "role_qc_desc" },
    { value: "worker", labelKey: "role_worker", descKey: "role_worker_desc" }
  ],

  SETTINGS_KEY: "abouamjad_settings_v1",
  DEFAULT_SETTINGS: {
    autoDirectionMode: "manual",
    autoHideWarning: false,
    soundEnabled: true,
    soundVolume: 0.9,
    hotkeysEnabled: true,
    validationMode: "strict",
    alertLevel: "standard",
    overdueDays: 1,
    showLowStockAlerts: true
  }
};

function getSettings() {
  try {
    const raw = localStorage.getItem(AppConfig.SETTINGS_KEY);
    if (!raw) return { ...AppConfig.DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...AppConfig.DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch {
    return { ...AppConfig.DEFAULT_SETTINGS };
  }
}

function setSettings(patch) {
  const next = { ...getSettings(), ...(patch || {}) };
  localStorage.setItem(AppConfig.SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function getOverdueDays() {
  const s = getSettings();
  const n = Number(s.overdueDays);
  if (Number.isFinite(n) && n >= 1) return Math.min(90, Math.floor(n));
  return Number(AppConfig.OVERDUE_DAYS) || 1;
}

function getToken() {
  return localStorage.getItem(AppConfig.TOKEN_KEY) || "";
}

function getApiToken() {
  return getToken();
}

function setToken(token) {
  if (!token) {
    clearToken();
    return;
  }
  localStorage.setItem(AppConfig.TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AppConfig.TOKEN_KEY);
  localStorage.removeItem(AppConfig.ROLE_KEY);
  localStorage.removeItem(AppConfig.USER_KEY);
  localStorage.removeItem(AppConfig.PERMS_KEY);
  localStorage.removeItem(AppConfig.AVATAR_KEY);
  localStorage.removeItem(AppConfig.FULLNAME_KEY);
}

function clearSession() {
  clearToken();
}

function getRole() {
  const r = normalizeRole(localStorage.getItem(AppConfig.ROLE_KEY) || "");
  return AppConfig.ROLES.includes(r) ? r : "";
}

function normalizeRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (!raw) return "";
  const map = {
    employee: "employee",
    "موظف": "employee",
    "أمين مخزن": "employee",
    store_keeper: "storekeeper",
    storekeeper: "storekeeper",
    store_manager: "store_manager",
    "store-manager": "store_manager",
    "store manager": "store_manager",
    storemanager: "store_manager",
    coo: "coo",
    "chief operating officer": "coo",
    worker: "worker",
    labor: "worker",
    labour: "worker",
    warehouse: "employee",
    keeper: "employee",
    staff: "employee",
    logistics: "logistics",
    logistic: "logistics",
    transport: "logistics",
    dispatch: "logistics",
    "لوجستيك": "logistics",
    engineer: "engineer",
    "مهندس": "engineer",
    supervisor: "supervisor",
    viewer: "viewer",
    safety: "safety",
    saftey: "safety",
    project_manager: "project_manager",
    "project-manager": "project_manager",
    "project manager": "project_manager",
    projectmanager: "project_manager",
    pm: "project_manager",
    project_engineer: "project_engineer",
    "project-engineer": "project_engineer",
    "project engineer": "project_engineer",
    projectengineer: "project_engineer",
    pe: "project_engineer",
    tech: "engineer",
    qc: "qc",
    quality: "qc",
    quality_control: "qc",
    "quality-control": "qc",
    "مراقبة الجودة": "qc",
    admin: "admin",
    administrator: "admin",
    "أدمن": "admin",
    "ادمن": "admin"
  };
  return map[raw] || (AppConfig.ROLES.includes(raw) ? raw : "");
}

function roleLabel(role = getRole()) {
  return AppConfig.ROLE_LABELS[normalizeRole(role)] || role || "";
}

function homePageForRole(role = getRole()) {
  const r = normalizeRole(role) || getRole();
  if (r === "worker") return AppConfig.ROLE_HOME.worker || "timesheet-portal.html";
  if (r === "admin") return AppConfig.ROLE_HOME.admin || "dashboard.html";

  const hrefById = {
    terminal: "index.html",
    outstanding: "outstanding.html",
    receiving: "receiving.html",
    damage: "damage.html",
    logs: "logs.html",
    products: "products.html",
    categories: "categories.html",
    people: "people.html",
    suppliers: "suppliers.html",
    consumables: "consumables.html",
    labels: "qr-labels.html",
    requests: "requests.html",
    forms: "forms.html",
    repair: "repair.html",
    warehouses: "warehouses.html",
    warehouseTransfer: "warehouse-transfer.html",
    projects: "warehouses.html#projects",
    qc: "qc.html",
    dashboard: "dashboard.html",
    settings: "settings.html",
    profile: "profile.html"
  };

  const preferredHref = AppConfig.ROLE_HOME[r] || "";
  const preferredId = Object.keys(hrefById).find((id) => hrefById[id] === preferredHref);
  if (preferredId && canAccessPage(preferredId)) return preferredHref;

  const order = [
    preferredId,
    "dashboard", "projects", "terminal", "products", "consumables",
    "requests", "forms", "people", "warehouses", "damage", "repair",
    "qc", "labels", "outstanding", "receiving", "logs"
  ].filter(Boolean);

  const seen = new Set();
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (canAccessPage(id) && hrefById[id]) return hrefById[id];
  }
  // Zero permissions → safe landing (never loop)
  return "profile.html";
}

function getPermissions() {
  try {
    const raw = localStorage.getItem(AppConfig.PERMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setPermissions(list) {
  const clean = Array.isArray(list) ? list.map(String) : [];
  localStorage.setItem(AppConfig.PERMS_KEY, JSON.stringify(clean));
  return clean;
}

/** Responsibility check: can('tool.receive') — only what the role matrix grants */
function can(permissionCode) {
  if (!permissionCode) return false;
  if (getRole() === "admin") return true;
  const perms = getPermissions();
  return perms.includes("*") || perms.includes(permissionCode);
}

function canAny(codes) {
  if (!codes || !codes.length) return false;
  return codes.some((c) => can(c));
}

/**
 * Menu / page gate: ONLY permissions assigned to the user's role.
 * Unknown / new sections without PAGE_PERMISSIONS → denied (except profile + settings).
 */
function canAccessPage(pageId) {
  if (!pageId) return false;
  // Every signed-in user can open profile + settings (theme / password)
  if (pageId === "profile" || pageId === "settings") return !!getToken();
  if (getRole() === "admin") return true;
  const need = AppConfig.PAGE_PERMISSIONS[pageId];
  if (!need || !need.length) return false;
  return canAny(need);
}

function getSessionUser() {
  return localStorage.getItem(AppConfig.USER_KEY) || "";
}

function getSessionAvatar() {
  return localStorage.getItem(AppConfig.AVATAR_KEY) || "";
}

function getSessionFullName() {
  return localStorage.getItem(AppConfig.FULLNAME_KEY) || "";
}

function setSession({ token, role, user, permissions, avatarUrl, fullName } = {}) {
  if (token) setToken(token);
  if (role) localStorage.setItem(AppConfig.ROLE_KEY, normalizeRole(role));
  if (user) localStorage.setItem(AppConfig.USER_KEY, String(user));
  if (permissions) setPermissions(permissions);
  if (avatarUrl != null) {
    if (avatarUrl) localStorage.setItem(AppConfig.AVATAR_KEY, String(avatarUrl));
    else localStorage.removeItem(AppConfig.AVATAR_KEY);
  }
  if (fullName != null) {
    if (fullName) localStorage.setItem(AppConfig.FULLNAME_KEY, String(fullName));
    else localStorage.removeItem(AppConfig.FULLNAME_KEY);
  }
}

function hasMinRole(minRole) {
  const rank = AppConfig.ROLE_RANK[getRole()] || 0;
  const need = AppConfig.ROLE_RANK[normalizeRole(minRole)] || 99;
  return rank >= need;
}

/** Strip {dd/mm/yyyy} braces */
function stripDateBraces(s) {
  return String(s || "").replace(/[{}]/g, "").trim();
}

/** Parse row_date like {18/07/2026} or 18/07/2026 → Date or null */
function parseRowDate(value) {
  const raw = stripDateBraces(value);
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display date for UI: dd/mm/yyyy (no braces) */
function formatDisplayDate(value) {
  if (value == null || value === "") return "—";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getFullYear()}`;
  }
  const parsed = parseRowDate(value);
  if (parsed) return formatDisplayDate(parsed);
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return formatDisplayDate(iso);
  return stripDateBraces(value) || "—";
}

/** Display datetime: dd/mm/yyyy HH:mm */
function formatDisplayDateTime(value) {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const p = parseRowDate(value);
    return p ? formatDisplayDate(p) : stripDateBraces(value) || "—";
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

/** Sort braced row dates chronologically ascending */
function sortRowDates(dates) {
  return [...(dates || [])].sort((a, b) => {
    const da = parseRowDate(a) || new Date(0);
    const db = parseRowDate(b) || new Date(0);
    return da - db;
  });
}

function getTheme() {
  const saved = localStorage.getItem(AppConfig.THEME_KEY);
  if (saved === "dark") return "dark";
  if (saved === "light") return "light";
  /* default: dark */
  return "dark";
}

function applyTheme() {
  const theme = getTheme();
  const isDark = theme === "dark";
  const root = document.documentElement;
  root.classList.toggle("theme-dark", isDark);
  root.classList.toggle("theme-light", !isDark);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const body = document.body;
  if (body) {
    body.classList.remove("theme-red", "theme-black");
    body.classList.add("tc-page");
    body.classList.toggle("theme-dark", isDark);
    body.classList.toggle("theme-light", !isDark);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      isDark ? AppConfig.THEME_COLOR_DARK : AppConfig.THEME_COLOR_LIGHT
    );
  }
}

function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(AppConfig.THEME_KEY, next);
  applyTheme();
  syncThemeControls();
}

function themeLabel() {
  return getTheme() === "dark" ? "Dark" : "Light";
}

function themeAccent() {
  return "teal";
}

function themeToggleText() {
  if (typeof t === "function") {
    return getTheme() === "dark" ? t("themeLight") : t("themeDark");
  }
  return getTheme() === "dark" ? "Light" : "Dark";
}

function initTheme() {
  applyTheme();
  syncThemeControls();
}

function syncThemeControls() {
  const isDark = getTheme() === "dark";
  const label = themeToggleText();
  document.querySelectorAll("[data-theme-toggle], .theme-switch").forEach((el) => {
    el.style.display = "";
    el.setAttribute("title", label);
    el.setAttribute("aria-label", label);
    const icon = el.querySelector("i.bi");
    if (icon) {
      icon.className = isDark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    }
    const text = el.querySelector("[data-theme-label]");
    if (text) text.textContent = label;
  });
}

/* Apply theme ASAP to avoid flash (before body/DOMContentLoaded) */
try {
  const saved = localStorage.getItem(AppConfig.THEME_KEY);
  const early = saved !== "light"; /* default dark when unset */
  document.documentElement.classList.toggle("theme-dark", early);
  document.documentElement.classList.toggle("theme-light", !early);
  document.documentElement.style.colorScheme = early ? "dark" : "light";
} catch (_) { /* ignore */ }

/* Redirect to login BEFORE page paints when there is no session */
(function earlyAuthGate() {
  try {
    const file = String((location.pathname || "").split("/").pop() || "index.html").toLowerCase();
    const publicPages = { "login.html": 1 };
    if (publicPages[file]) return;
    const token = localStorage.getItem(AppConfig.TOKEN_KEY) || "";
    if (!token) {
      document.documentElement.classList.add("tc-auth-redirect");
      location.replace("login.html");
    }
  } catch (_) { /* ignore */ }
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
  });
} else {
  initTheme();
}

function requireAuth() {
  if (!getToken()) {
    window.location.replace("login.html");
    return false;
  }
  if (!getRole()) {
    localStorage.setItem(AppConfig.ROLE_KEY, "employee");
  }
  return true;
}

function isTool(code) {
  if (!code) return false;
  return AppConfig.TOOL_PREFIXES.includes(code.charAt(0).toUpperCase());
}

/** Consumables (C…) — OUT issues; IN returns unused qty back to stock */
function isConsumable(code) {
  if (!code) return false;
  return code.charAt(0).toUpperCase() === "C";
}

function getPpeRules() {
  return (AppConfig.PPE_RULES || []).map((r) => ({
    id: r.id,
    label: r.label || r.id,
    re: new RegExp(r.pattern || r.id, "i")
  }));
}

function matchPpeFamily(textBlob) {
  const blob = String(textBlob || "");
  if (!blob.trim()) return null;
  for (const rule of getPpeRules()) {
    if (rule.re.test(blob)) return { id: rule.id, label: rule.label };
  }
  return null;
}

function getPpeCooldownDays() {
  const n = Number(AppConfig.PPE_COOLDOWN_DAYS);
  if (Number.isFinite(n) && n >= 1) return Math.min(90, Math.floor(n));
  return 7;
}

function escHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'`]/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "`": "&#96;"
    }[m] || m)
  );
}

function parseApiResponse(text) {
  if (!text) return null;
  if (text === "UNAUTHORIZED") return { error: "UNAUTHORIZED" };
  if (text === "SERVER_BUSY") return { error: "SERVER_BUSY" };
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('"status":"OK"') || text.includes('"status": "OK"')) return { status: "OK" };
    if (text.includes("UNAUTHORIZED")) return { error: "UNAUTHORIZED" };
    return null;
  }
}

async function apiGet(params) {
  const token = getApiToken();
  if (!token) return { error: "UNAUTHORIZED" };
  const qs = new URLSearchParams({ ...params, token });
  const url = `${AppConfig.SCRIPT_URL}?${qs}`;
  const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
  const data = parseApiResponse(await res.text());
  if (data === null) throw new Error("Invalid server response");
  return data;
}

/** POST form fields — most reliable for Google Apps Script from GitHub Pages */
async function apiPostForm(fields) {
  const token = getApiToken();
  if (!token && fields.action !== "login") return { error: "UNAUTHORIZED" };
  const payload = { ...fields, token };
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
  });
  const res = await fetch(AppConfig.SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
    redirect: "follow"
  });
  const data = parseApiResponse(await res.text());
  if (data === null) throw new Error("Invalid server response");
  return data;
}

/** POST JSON as text/plain (large photo payloads) */
async function apiPostPlain(body) {
  const token = getApiToken();
  if (!token) return { error: "UNAUTHORIZED" };
  const payload = { ...body, token };
  const res = await fetch(AppConfig.SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store",
    redirect: "follow"
  });
  const data = parseApiResponse(await res.text());
  if (data === null) throw new Error("Invalid server response");
  return data;
}

/** Submit damage — GET without photo; POST with photo */
async function apiSubmitDamage({ toolCode, personCode, qty, remark, date, imageBase64 }) {
  const base = {
    action: "submitDamage",
    toolCode,
    personCode,
    qty: String(qty || 1),
    remark: remark || "No remark"
  };
  if (date) base.date = date;

  if (!imageBase64) {
    return apiGet(base);
  }

  try {
    return await apiPostPlain({ ...base, imageBase64 });
  } catch (e1) {
    try {
      return await apiPostForm({ ...base, imageBase64 });
    } catch (e2) {
      throw e2;
    }
  }
}

async function loadDamageDateOptions(selectEl) {
  selectEl.innerHTML = `<option value="">${typeof t === "function" ? t("loading") : "…"}</option>`;
  try {
    const dates = await apiGet({ action: "getDamageDates" });
    selectEl.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = typeof t === "function" ? t("all") : "All";
    selectEl.appendChild(allOpt);
    if (dates && dates.error) {
      return [];
    }
    const list = typeof sortRowDates === "function" ? sortRowDates(Array.isArray(dates) ? dates : []) : (Array.isArray(dates) ? dates : []);
    list.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = typeof formatDisplayDate === "function" ? formatDisplayDate(d) : String(d).replace(/[{}]/g, "");
      selectEl.appendChild(o);
    });
    return list;
  } catch {
    selectEl.innerHTML = `<option value="">${typeof t === "function" ? t("all") : "All"}</option>`;
    return [];
  }
}

/** Persistent per-terminal device id — isolates scan sessions even when
 *  two terminals are logged in under the same storekeeper account. */
function getDeviceId() {
  try {
    let id = localStorage.getItem("tcDeviceId");
    if (!id) {
      const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      id = "dev_" + rand.slice(0, 24);
      localStorage.setItem("tcDeviceId", id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Per-tab session id (sessionStorage) — isolates two Terminal tabs on same browser. */
function getScanSessionId() {
  try {
    let id = sessionStorage.getItem("tcScanSessionId");
    if (!id) {
      const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      id = "ses_" + rand.slice(0, 24);
      sessionStorage.setItem("tcScanSessionId", id);
    }
    return id;
  } catch {
    return "";
  }
}

function rotateScanSessionId() {
  try {
    const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const id = "ses_" + rand.slice(0, 24);
    sessionStorage.setItem("tcScanSessionId", id);
    return id;
  } catch {
    return "";
  }
}

/** Sync scan — requires readable JSON ack (no optimistic no-cors).
 *  Pass clientTs + clientSeq + deviceId + sessionId so offline reconnect keeps true order. */
async function syncScan(code, meta = {}) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const params = {
      scanData: code,
      deviceId: meta.deviceId || getDeviceId(),
      sessionId: meta.sessionId || getScanSessionId(),
    };
    if (meta.timestamp != null) params.clientTs = String(meta.timestamp);
    if (meta.seq != null) params.clientSeq = String(meta.seq);
    if (meta.ppeOverride) params.ppeOverride = "1";
    const data = await apiGet(params);
    if (data && data.status === "OK") return { ok: true, data };
    if (data && data.error) return { ok: false, error: data.error };
    return { ok: false, error: "SYNC_FAILED" };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

async function acquireTerminalSession(meta = {}) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const data = await apiPostPlain({
      action: "acquireTerminalSession",
      deviceId: meta.deviceId || getDeviceId(),
      sessionId: meta.sessionId || getScanSessionId(),
    });
    if (data && data.success) return { ok: true, data };
    if (data && data.error) return { ok: false, error: data.error, data };
    return { ok: false, error: "SESSION_ACQUIRE_FAILED", data };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

async function heartbeatTerminalSession(meta = {}) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const data = await apiPostPlain({
      action: "heartbeatTerminalSession",
      deviceId: meta.deviceId || getDeviceId(),
      sessionId: meta.sessionId || getScanSessionId(),
    });
    if (data && data.success) return { ok: true, data };
    if (data && data.error) return { ok: false, error: data.error, data };
    return { ok: false, error: "SESSION_HEARTBEAT_FAILED", data };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

async function releaseTerminalSession(meta = {}) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const data = await apiPostPlain({
      action: "releaseTerminalSession",
      deviceId: meta.deviceId || getDeviceId(),
      sessionId: meta.sessionId || getScanSessionId(),
    });
    if (data && data.success) return { ok: true, data };
    if (data && data.error) return { ok: false, error: data.error, data };
    return { ok: false, error: "SESSION_RELEASE_FAILED", data };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

async function resetTerminalSession(meta = {}) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const data = await apiPostPlain({
      action: "resetTerminalSession",
      deviceId: meta.deviceId || getDeviceId(),
      sessionId: meta.sessionId || getScanSessionId(),
    });
    if (data && data.success) return { ok: true, data };
    if (data && data.error) return { ok: false, error: data.error, data };
    return { ok: false, error: "SESSION_RESET_FAILED", data };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

/** Client audit helper (server appends when supported) */
async function logAudit(action, detail = {}, before = "", after = "") {
  try {
    if (!getApiToken()) return { ok: false };
    const data = await apiPostForm({
      action: "auditLog",
      auditAction: action,
      detail: typeof detail === "string" ? detail : JSON.stringify(detail),
      before: typeof before === "string" ? before : JSON.stringify(before),
      after: typeof after === "string" ? after : JSON.stringify(after),
      user: getSessionUser(),
      role: getRole(),
      device: (navigator.userAgent || "").slice(0, 180)
    });
    return { ok: !!(data && (data.success || data.ok)) };
  } catch {
    return { ok: false };
  }
}

async function loadDateOptions(selectEl) {
  selectEl.innerHTML = `<option value="">${typeof t === "function" ? t("loading") : "…"}</option>`;
  try {
    const dates = await apiGet({ action: "getDates" });
    if (dates && dates.error) {
      selectEl.innerHTML = `<option value="">❌ ${escHtml(dates.error)}</option>`;
      return [];
    }
    if (!dates || !dates.length) {
      selectEl.innerHTML = `<option value="">${typeof t === "function" ? t("noRows") : "—"}</option>`;
      return [];
    }
    selectEl.innerHTML = "";
    const sorted = typeof sortRowDates === "function" ? sortRowDates(dates) : [...dates];
    const rev = [...sorted].reverse();
    rev.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = typeof formatDisplayDate === "function" ? formatDisplayDate(d) : String(d).replace(/[{}]/g, "");
      selectEl.appendChild(o);
    });
    return rev;
  } catch {
    selectEl.innerHTML = `<option value="">${typeof t === "function" ? t("error") : "Error"}</option>`;
    return [];
  }
}

function initials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

async function loginRequest(user, pass) {
  const trimmedUser = String(user || "").trim();
  const trimmedPass = String(pass || "");
  if (!trimmedUser || !trimmedPass) return { ok: false, badCreds: true };

  function parseLogin(data) {
    if (data && data.success && data.token) {
      return {
        ok: true,
        token: data.token,
        role: normalizeRole(data.role || "admin"),
        user: data.user || trimmedUser,
        fullName: data.fullName || "",
        avatarUrl: data.avatarUrl || "",
        permissions: Array.isArray(data.permissions) ? data.permissions : []
      };
    }
    if (data && data.success === false) {
      return { ok: false, badCreds: true, error: data.error || "" };
    }
    return null;
  }

  async function tryFormPost() {
    const form = new URLSearchParams();
    form.append("action", "login");
    form.append("user", trimmedUser);
    form.append("pass", trimmedPass);
    const res = await fetch(AppConfig.SCRIPT_URL, {
      method: "POST",
      cache: "no-store",
      redirect: "follow",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    return parseLogin(parseApiResponse(await res.text()));
  }

  try {
    const fromForm = await tryFormPost();
    if (fromForm) return fromForm;
    return { ok: false, network: true };
  } catch {
    return { ok: false, network: true };
  }
}

async function registerRequest(payload) {
  const fullName = String(payload.fullName || "").trim();
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim();
  const role = normalizeRole(payload.role || "employee");

  function parseRegister(data) {
    if (data && data.success && data.pending) return { ok: true, pending: true, username: data.username || username };
    if (data && data.success === false) return { ok: false, error: data.error || "FAILED" };
    return null;
  }

  const form = new URLSearchParams();
  form.append("action", "registerUser");
  form.append("fullName", fullName);
  form.append("username", username);
  form.append("password", password);
  form.append("phone", phone);
  form.append("email", email);
  form.append("role", role);

  try {
    const res = await fetch(AppConfig.SCRIPT_URL, {
      method: "POST",
      cache: "no-store",
      redirect: "follow",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    const parsed = parseRegister(parseApiResponse(await res.text()));
    if (parsed) return parsed;
    return { ok: false, error: "FAILED" };
  } catch {
    return { ok: false, network: true };
  }
}

/** Compress image for GAS upload (keeps payload small) */
function compressImageFile(file, maxSide = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function getProductImages(code) {
  const params = { action: "getProductImages" };
  if (code) params.code = code;
  const data = await apiGet(params);
  if (data && data.error) {
    if (String(data.error).includes("NO ACTION")) {
      throw new Error("السيرفر قديم — لازم Deploy لـ Code.gs (صور المنتجات)");
    }
    throw new Error(data.error);
  }
  return (data && data.images) || {};
}

async function setProductImage(code, imageBase64) {
  let data;
  try {
    data = await apiPostPlain({
      action: "setProductImage",
      code,
      imageBase64,
      user: getSessionUser(),
      role: getRole()
    });
  } catch (e1) {
    data = await apiPostForm({
      action: "setProductImage",
      code,
      imageBase64,
      user: getSessionUser(),
      role: getRole()
    });
  }
  if (data && data.error) {
    if (String(data.error).includes("NO ACTION")) {
      throw new Error("السيرفر قديم — انسخ Code.gs.txt وعمل Deploy New version");
    }
    throw new Error(data.error);
  }
  return data;
}

async function clearProductImage(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) throw new Error("Code required");
  let data;
  try {
    data = await apiPostPlain({
      action: "clearProductImage",
      code: c,
      user: getSessionUser(),
      role: getRole()
    });
  } catch (_) {
    data = await apiGet({
      action: "clearProductImage",
      code: c
    });
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function setPersonIdImage(code, imageBase64) {
  let data;
  try {
    data = await apiPostPlain({
      action: "setPersonIdImage",
      code,
      imageBase64,
      user: getSessionUser(),
      role: getRole()
    });
  } catch (e1) {
    data = await apiPostForm({
      action: "setPersonIdImage",
      code,
      imageBase64,
      user: getSessionUser(),
      role: getRole()
    });
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

function productThumbHtml(url, code, size = 48) {
  const esc = typeof escHtml === "function" ? escHtml : (s => String(s || ""));
  const raw = String(url || "").trim();
  const safeUrl = /^(https?:\/\/|\/|data:image\/)/i.test(raw) ? raw : "";
  if (safeUrl) {
    return `<img class="tc-product-thumb" src="${esc(safeUrl)}" alt="${esc(code || "")}" width="${size}" height="${size}" loading="lazy">`;
  }
  return `<div class="tc-product-thumb placeholder" style="width:${size}px;height:${size}px"><i class="bi bi-image"></i></div>`;
}
