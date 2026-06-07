/** إعدادات مشتركة */
const AppConfig = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyHXMuZcmFT7KrvqR8cygFl-t-oU_Jh4Vr2L4yp1eoT5AQAL00rbjBbUL0aKod3_C8l7g/exec",
  TOKEN_KEY: "token",
  SESSION_TOKEN: "abouamjad_secure_session_token",
  TOOL_PREFIXES: ["I", "E", "C", "B"]
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
