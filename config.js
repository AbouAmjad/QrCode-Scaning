/** إعدادات مشتركة — VPS + PostgreSQL API */
const AppConfig = {
  // Same-origin API on aics.iskndr.com / VPS IP (nginx → Node)
  SCRIPT_URL: (typeof location !== "undefined" && location.protocol && location.protocol !== "file:")
    ? (location.origin + "/api")
    : "https://aics.iskndr.com/api",
  TOKEN_KEY: "token",
  ROLE_KEY: "tc_role",
  USER_KEY: "tc_user",
  THEME_KEY: "uiTheme",
  /** @deprecated Never use as API fallback — login must return a server token */
  SESSION_TOKEN: "",
  TOOL_PREFIXES: ["I", "E", "C", "B"],
  OVERDUE_DAYS: 1,
  DASHBOARD_REFRESH_MS: 30000,
  /** employee=موظف · engineer=مهندس · admin=أدمن */
  ROLES: ["employee", "engineer", "admin"],
  ROLE_RANK: { employee: 1, engineer: 2, admin: 3 },
  ROLE_HOME: {
    employee: "index.html",
    engineer: "inventory.html",
    admin: "dashboard.html"
  },
  ROLE_LABELS: {
    employee: "موظف",
    engineer: "مهندس",
    admin: "أدمن"
  },
  /** pages each role may open (admin gets all) */
  ROLE_PAGES: {
    employee: ["terminal", "outstanding", "receiving", "damage", "products", "timesheet"],
    engineer: ["inventory", "requests", "overview", "search", "consumables", "notifications", "products", "timesheet"],
    admin: ["*"]
  },

  // Settings
  SETTINGS_KEY: "toolcustody_settings_v1",
  DEFAULT_SETTINGS: {
    autoDirectionMode: "manual", // manual | last
    autoHideWarning: false,
    soundEnabled: true,
    soundVolume: 0.9, // 0..1 (used by index.html oscillators)
    offlineQueueLimit: 300,
    hotkeysEnabled: true,
    validationMode: "strict", // strict | lenient
    alertLevel: "standard" // standard | high
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


function getToken() {
  return localStorage.getItem(AppConfig.TOKEN_KEY) || "";
}

/** API token from login session only — never a public hardcoded fallback */
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
    store_keeper: "employee",
    storekeeper: "employee",
    keeper: "employee",
    staff: "employee",
    engineer: "engineer",
    "مهندس": "engineer",
    supervisor: "engineer",
    viewer: "engineer",
    tech: "engineer",
    admin: "admin",
    administrator: "admin",
    "أدمن": "admin",
    "ادمن": "admin"
  };
  return map[raw] || (AppConfig.ROLES.includes(raw) ? raw : "employee");
}

function roleLabel(role = getRole()) {
  return AppConfig.ROLE_LABELS[normalizeRole(role)] || role || "";
}

function homePageForRole(role = getRole()) {
  return AppConfig.ROLE_HOME[normalizeRole(role)] || "index.html";
}

function canAccessPage(pageId) {
  const role = getRole() || "employee";
  if (role === "admin") return true;
  const allowed = AppConfig.ROLE_PAGES[role] || [];
  return allowed.includes("*") || allowed.includes(pageId);
}

function getSessionUser() {
  return localStorage.getItem(AppConfig.USER_KEY) || "";
}

function setSession({ token, role, user } = {}) {
  if (token) setToken(token);
  if (role) localStorage.setItem(AppConfig.ROLE_KEY, normalizeRole(role));
  if (user) localStorage.setItem(AppConfig.USER_KEY, String(user));
}

function hasMinRole(minRole) {
  const rank = AppConfig.ROLE_RANK[getRole()] || 0;
  const need = AppConfig.ROLE_RANK[normalizeRole(minRole)] || 99;
  return rank >= need;
}

function getTheme() {
  const saved = localStorage.getItem(AppConfig.THEME_KEY);
  return saved === "red" ? "red" : "black";
}

function setTheme(theme) {
  const next = theme === "red" ? "red" : "black";
  localStorage.setItem(AppConfig.THEME_KEY, next);
  applyTheme(next);
  return next;
}

function applyTheme(theme = getTheme()) {
  const body = document.body;
  if (!body) return theme;
  const next = theme === "red" ? "red" : "black";
  body.classList.remove("theme-black", "theme-red");
  body.classList.add(next === "red" ? "theme-red" : "theme-black");
  body.dataset.theme = next;
  return next;
}

function toggleTheme() {
  return setTheme(getTheme() === "red" ? "black" : "red");
}

function themeLabel(theme = getTheme()) {
  return theme === "red" ? "Red" : "Black";
}

function themeAccent(theme = getTheme()) {
  return theme === "red" ? "danger" : "dark";
}

function themeToggleText() {
  return getTheme() === "red" ? "Switch to Black" : "Switch to Red";
}

function initTheme() {
  applyTheme();
}

function syncThemeControls() {
  const label = themeToggleText();
  document.querySelectorAll("[data-theme-toggle]").forEach(el => {
    el.textContent = label;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    syncThemeControls();
  });
} else {
  initTheme();
  syncThemeControls();
}

function requireAuth() {
  if (!getToken()) {
    window.location = "login.html";
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

/** Consumables (C…) — log issuance only, no return/custody tracking */
function isConsumable(code) {
  if (!code) return false;
  return code.charAt(0).toUpperCase() === "C";
}

function escHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] || m));
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
  selectEl.innerHTML = '<option value="">⏳ loading…</option>';
  try {
    const dates = await apiGet({ action: "getDamageDates" });
    selectEl.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "All dates";
    selectEl.appendChild(allOpt);
    if (dates && dates.error) {
      allOpt.textContent = "All dates (calendar unavailable)";
      return [];
    }
    const list = Array.isArray(dates) ? dates : [];
    list.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      selectEl.appendChild(o);
    });
    return list;
  } catch {
    selectEl.innerHTML = '<option value="">All dates</option>';
    return [];
  }
}

/** Sync scan — requires readable JSON ack (no optimistic no-cors) */
async function syncScan(code) {
  try {
    if (!getApiToken()) return { ok: false, error: "UNAUTHORIZED" };
    const data = await apiGet({ scanData: code });
    if (data && data.status === "OK") return { ok: true };
    if (data && data.error) return { ok: false, error: data.error };
    return { ok: false, error: "SYNC_FAILED" };
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
  selectEl.innerHTML = '<option value="">⏳ loading…</option>';
  try {
    const dates = await apiGet({ action: "getDates" });
    if (dates && dates.error) {
      selectEl.innerHTML = `<option value="">❌ ${escHtml(dates.error)}</option>`;
      return [];
    }
    if (!dates || !dates.length) {
      selectEl.innerHTML = '<option value="">⚠️ No records</option>';
      return [];
    }
    selectEl.innerHTML = "";
    const rev = [...dates].reverse();
    rev.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      selectEl.appendChild(o);
    });
    return rev;
  } catch {
    selectEl.innerHTML = '<option value="">❌ Error</option>';
    return [];
  }
}

function initials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

async function loginRequest(user, pass) {
  const url = `${AppConfig.SCRIPT_URL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
    const data = parseApiResponse(await res.text());
    if (data && data.success && data.token) {
      return {
        ok: true,
        token: data.token,
        role: normalizeRole(data.role || "admin"),
        user: data.user || user
      };
    }
    if (data && data.success === false) return { ok: false, badCreds: true };
    return { ok: false, network: true };
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

function productThumbHtml(url, code, size = 48) {
  const esc = typeof escHtml === "function" ? escHtml : (s => String(s || ""));
  if (url) {
    return `<img class="tc-product-thumb" src="${esc(url)}" alt="${esc(code || "")}" width="${size}" height="${size}" loading="lazy">`;
  }
  return `<div class="tc-product-thumb placeholder" style="width:${size}px;height:${size}px"><i class="bi bi-image"></i></div>`;
}
