/** إعدادات مشتركة */
const AppConfig = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyHXMuZcmFT7KrvqR8cygFl-t-oU_Jh4Vr2L4yp1eoT5AQAL00rbjBbUL0aKod3_C8l7g/exec",
  TOKEN_KEY: "token",
  THEME_KEY: "uiTheme",
  SESSION_TOKEN: "abouamjad_secure_session_token",
  TOOL_PREFIXES: ["I", "E", "C", "B"],
  OVERDUE_DAYS: 1,
  DASHBOARD_REFRESH_MS: 30000,

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

/** POST form fields — most reliable for Google Apps Script from GitHub Pages */
async function apiPostForm(fields) {
  const payload = { ...fields, token: getApiToken() };
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
  const payload = { ...body, token: getApiToken() };
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
