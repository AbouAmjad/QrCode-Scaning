/** إعدادات مشتركة */
const AppConfig = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyHXMuZcmFT7KrvqR8cygFl-t-oU_Jh4Vr2L4yp1eoT5AQAL00rbjBbUL0aKod3_C8l7g/exec",
  TOKEN_KEY: "token",
  THEME_KEY: "uiTheme",
  SESSION_TOKEN: "abouamjad_secure_session_token",
  TOOL_PREFIXES: ["I", "E", "C", "B"],
  OVERDUE_DAYS: 1,
  DASHBOARD_REFRESH_MS: 30000
};

function getToken() {
  return localStorage.getItem(AppConfig.TOKEN_KEY) || "";
}

/** token للـ API — يستخدم fallback إذا ما في جلسة (مثل النسخة القديمة) */
function getApiToken() {
  return getToken() || AppConfig.SESSION_TOKEN;
}

function setToken(token) {
  localStorage.setItem(AppConfig.TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AppConfig.TOKEN_KEY);
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

function injectThemeStyles() {
  if (document.getElementById("theme-style-shared")) return;
  const style = document.createElement("style");
  style.id = "theme-style-shared";
  style.textContent = `
    body.theme-black {
      --theme-bg: linear-gradient(145deg,#f0f4fa 0%,#e9eff5 58%,#fbfcfe 100%);
      --theme-panel: rgba(255,255,255,0.94);
      --theme-panel-strong: rgba(255,255,255,0.98);
      --theme-text: #0a2540;
      --theme-muted: #64748b;
      --theme-border: rgba(148,163,184,0.16);
      --theme-accent: #ef4444;
      --theme-accent-2: #1f3a6b;
      --theme-accent-soft: rgba(239,68,68,0.1);
      --theme-danger: #dc2626;
      --theme-warning: #f59e0b;
    }
    body.theme-red {
      --theme-bg: linear-gradient(145deg,#fff1f3 0%,#ffe4e6 58%,#fff7f8 100%);
      --theme-panel: rgba(255,255,255,0.96);
      --theme-panel-strong: rgba(255,255,255,1);
      --theme-text: #4c0519;
      --theme-muted: #9f1239;
      --theme-border: rgba(244,63,94,0.18);
      --theme-accent: #ef4444;
      --theme-accent-2: #be123c;
      --theme-accent-soft: rgba(244,63,94,0.08);
      --theme-danger: #dc2626;
      --theme-warning: #f59e0b;
    }
    body.theme-black, body.theme-red {
      background: var(--theme-bg) !important;
      color: var(--theme-text) !important;
    }
    body.theme-black .glass-panel,
    body.theme-red .glass-panel,
    body.theme-black .dash-panel,
    body.theme-red .dash-panel,
    body.theme-black .card-dark,
    body.theme-red .card-dark,
    body.theme-black #loginBox,
    body.theme-red #loginBox,
    body.theme-black .container,
    body.theme-red .container {
      background: var(--theme-panel) !important;
      color: var(--theme-text) !important;
      border-color: var(--theme-border) !important;
      box-shadow: 0 25px 45px -12px rgba(0,0,0,0.15), 0 0 0 1px var(--theme-border) !important;
    }
    body.theme-black .premium-header,
    body.theme-red .premium-header,
    body.theme-black .header,
    body.theme-red .header,
    body.theme-black .premium-header,
    body.theme-red .premium-header {
      border-bottom-color: var(--theme-border) !important;
    }
    body.theme-black .section-badge,
    body.theme-red .section-badge,
    body.theme-black .day-label,
    body.theme-red .day-label,
    body.theme-black .logo p,
    body.theme-red .logo p,
    body.theme-black .text-muted,
    body.theme-red .text-muted,
    body.theme-black .text-secondary,
    body.theme-red .text-secondary,
    body.theme-black .small,
    body.theme-red .small,
    body.theme-black .form-sel,
    body.theme-red .form-sel,
    body.theme-black .search-box,
    body.theme-red .search-box,
    body.theme-black .search-dash,
    body.theme-red .search-dash,
    body.theme-black .back-btn,
    body.theme-red .back-btn,
    body.theme-black .nav-btn,
    body.theme-red .nav-btn,
    body.theme-black .filter-btn,
    body.theme-red .filter-btn,
    body.theme-black .badge,
    body.theme-red .badge {
      color: var(--theme-text) !important;
    }
    body.theme-black .section-badge,
    body.theme-red .section-badge,
    body.theme-black .day-group,
    body.theme-red .day-group,
    body.theme-black .empty-state,
    body.theme-red .empty-state,
    body.theme-black .table-wrap,
    body.theme-red .table-wrap,
    body.theme-black .workers-card,
    body.theme-red .workers-card {
      background: var(--theme-panel-strong) !important;
      border-color: var(--theme-border) !important;
    }
    body.theme-black .btn-prim,
    body.theme-red .btn-prim,
    body.theme-black .nav-btn.primary,
    body.theme-red .nav-btn.primary,
    body.theme-black .login-btn,
    body.theme-red .login-btn,
    body.theme-black .btn-report,
    body.theme-red .btn-report,
    body.theme-black .btn-danger,
    body.theme-red .btn-danger {
      background: linear-gradient(135deg,var(--theme-accent-2),var(--theme-danger)) !important;
      border-color: var(--theme-accent-2) !important;
      color: white !important;
    }
    body.theme-black .nav-btns button,
    body.theme-red .nav-btns button,
    body.theme-black .nav-btn,
    body.theme-red .nav-btn,
    body.theme-black .back-btn,
    body.theme-red .back-btn,
    body.theme-black .filter-btn,
    body.theme-red .filter-btn,
    body.theme-black .form-sel,
    body.theme-red .form-sel,
    body.theme-black .search-box,
    body.theme-red .search-box,
    body.theme-black .search-dash,
    body.theme-red .search-dash {
      background: rgba(255,255,255,0.9) !important;
      color: var(--theme-text) !important;
      border-color: var(--theme-border) !important;
      box-shadow: 0 8px 18px rgba(15,23,42,0.04) !important;
    }
    body.theme-black .btn-outline-primary,
    body.theme-red .btn-outline-primary,
    body.theme-black .btn-outline-danger,
    body.theme-red .btn-outline-danger,
    body.theme-black .btn-outline-secondary,
    body.theme-red .btn-outline-secondary,
    body.theme-black .btn-outline-success,
    body.theme-red .btn-outline-success {
      border-color: var(--theme-border) !important;
      color: var(--theme-text) !important;
      background: rgba(255,255,255,0.04) !important;
    }
    body.theme-black .btn-outline-primary:hover,
    body.theme-red .btn-outline-primary:hover,
    body.theme-black .btn-outline-danger:hover,
    body.theme-red .btn-outline-danger:hover,
    body.theme-black .btn-outline-secondary:hover,
    body.theme-red .btn-outline-secondary:hover,
    body.theme-black .btn-outline-success:hover,
    body.theme-red .btn-outline-success:hover {
      background: var(--theme-accent-soft) !important;
      color: var(--theme-text) !important;
    }
    body.theme-black .kpi,
    body.theme-red .kpi,
    body.theme-black .stat-card,
    body.theme-red .stat-card,
    body.theme-black .tool-card,
    body.theme-red .tool-card,
    body.theme-black .worker-item,
    body.theme-red .worker-item,
    body.theme-black .holder-card,
    body.theme-red .holder-card,
    body.theme-black .damage-card,
    body.theme-red .damage-card,
    body.theme-black .log-item,
    body.theme-red .log-item {
      background: rgba(255,255,255,0.98) !important;
      border-color: var(--theme-border) !important;
      color: var(--theme-text) !important;
    }
    body.theme-black .damage-remark,
    body.theme-red .damage-remark,
    body.theme-black .search-result,
    body.theme-red .search-result,
    body.theme-black .timeline-item,
    body.theme-red .timeline-item {
      color: var(--theme-text) !important;
    }
    body.theme-black input,
    body.theme-red input,
    body.theme-black select,
    body.theme-red select,
    body.theme-black textarea,
    body.theme-red textarea {
      background: rgba(255,255,255,0.98) !important;
      color: var(--theme-text) !important;
      border-color: var(--theme-border) !important;
    }
    body.theme-black input::placeholder,
    body.theme-red input::placeholder,
    body.theme-black textarea::placeholder,
    body.theme-red textarea::placeholder {
      color: var(--theme-muted) !important;
    }
    body.theme-black .custom-table th,
    body.theme-red .custom-table th,
    body.theme-black .table-dark th,
    body.theme-red .table-dark th {
      background: rgba(15,43,61,0.96) !important;
      color: var(--theme-text) !important;
    }
    body.theme-black .custom-table td,
    body.theme-red .custom-table td,
    body.theme-black .table td,
    body.theme-red .table td {
      color: var(--theme-text) !important;
      border-color: var(--theme-border) !important;
    }
    .theme-switch {
      min-width: 126px;
      justify-content: center;
      border-radius: 999px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
  `;
  document.head.appendChild(style);
}

injectThemeStyles();
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
  return true;
}

function isTool(code) {
  if (!code) return false;
  return AppConfig.TOOL_PREFIXES.includes(code.charAt(0).toUpperCase());
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
  const qs = new URLSearchParams({ ...params, token: getApiToken() });
  const url = `${AppConfig.SCRIPT_URL}?${qs}`;
  const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
  const data = parseApiResponse(await res.text());
  if (data === null) throw new Error("Invalid server response");
  return data;
}

/** sync — no-cors مثل النسخة الأصلية (GAS + file:// ما بيدعموا قراءة الرد دائماً) */
async function syncScan(code) {
  const qs = new URLSearchParams({ scanData: code, token: getApiToken() });
  const url = `${AppConfig.SCRIPT_URL}?${qs}`;
  try {
    await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function loadDateOptions(selectEl) {
  selectEl.innerHTML = '<option value="">⏳ loading…</option>';
  try {
    const dates = await apiGet({ action: "getDates" });
    if (dates && dates.error) {
      selectEl.innerHTML = `<option value="">❌ ${dates.error}</option>`;
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
    if (data && data.success && data.token) return { ok: true, token: data.token };
    if (data && data.success === false) return { ok: false, badCreds: true };
  } catch { /* جرب no-cors */ }
  try {
    await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" });
    return { ok: true, token: AppConfig.SESSION_TOKEN, fallback: true };
  } catch {
    return { ok: false, network: true };
  }
}
