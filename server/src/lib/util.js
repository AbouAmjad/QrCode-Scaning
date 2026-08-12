const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/toolcustody/uploads";
const PUBLIC_BASE = process.env.PUBLIC_BASE || "https://aics.iskndr.com";

const TOOL_PREFIXES = ["I", "E", "C", "B"];
const DIRECTIONS = ["IN", "OUT"];

/**
 * PPE detection rules (mirrored in frontend config.js).
 * Matching means the item is subject to cooldown; the cooldown window itself
 * is enforced per product code (see custody.lastPpeIssue + checkPpeCooldown).
 */
const PPE_RULES = [
  {
    id: "gloves",
    label: "Gloves",
    pattern: "glove|gloves|قفاز|قفازات|^c12([-a-z0-9]|$)",
  },
  {
    id: "glasses",
    label: "Safety glasses",
    pattern:
      "goggle|goggles|glasses|sunglass|sunglasses|saftey|eye\\s*protect|safety\\s*glass|نظارة|نظارات|^c13([-a-z0-9]|$)",
  },
];
const PPE_COOLDOWN_DAYS = Number(process.env.PPE_COOLDOWN_DAYS || 6) || 6;

function ensureUploadDir() {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.warn("[uploads] cannot create", UPLOAD_DIR, (e && e.message) || e);
  }
}

/* ------------------------------------------------------------------ types */

function str(v, fallback = "") {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function trimmed(v, fallback = "") {
  return str(v, fallback).trim();
}

function upper(v) {
  return trimmed(v).toUpperCase();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v, fallback = 0) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

function posInt(v, fallback = 1) {
  const n = int(v, fallback);
  return n > 0 ? n : fallback;
}

function bool(v) {
  if (v === true) return true;
  if (v === false || v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Accepts a real array, or a JSON string (form posts stringify arrays). */
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nullableDate(v) {
  const s = trimmed(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s;
}

/* ------------------------------------------------------------------ dates */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Legacy sheet-style date token: {dd/mm/yyyy} */
function rowDateOf(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return `{${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}}`;
}

function rowDateNow() {
  return rowDateOf(new Date());
}

function stripBraces(v) {
  return str(v).replace(/[{}]/g, "").trim();
}

/** Parses {dd/mm/yyyy}, dd/mm/yyyy or anything Date understands. */
function parseRowDate(value) {
  const raw = stripBraces(value);
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return stripBraces(value);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDateTime(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return stripBraces(value);
  return `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isoOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whole days elapsed since `value`, never negative. */
function daysSince(value, now = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now - d.getTime()) / 86400000));
}

/** Whole days until `value`; negative when already past. */
function daysUntil(value, now = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now) / 86400000);
}

function isoDateOnly(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return str(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ------------------------------------------------------------------ codes */

function isPersonCode(code) {
  return upper(code).startsWith("P");
}

function isDirection(code) {
  return DIRECTIONS.includes(upper(code));
}

function isToolCode(code) {
  const c = upper(code);
  if (!c || isDirection(c)) return false;
  return TOOL_PREFIXES.includes(c.charAt(0));
}

function isConsumableCode(code) {
  return upper(code).charAt(0) === "C";
}

function kindForCode(code) {
  const c = upper(code);
  if (isPersonCode(c)) return "person";
  if (isConsumableCode(c)) return "consumable";
  return "tool";
}

/* -------------------------------------------------------------------- PPE */

function matchPpeFamily(textBlob) {
  const blob = str(textBlob);
  if (!blob.trim()) return null;
  for (const rule of PPE_RULES) {
    try {
      if (new RegExp(rule.pattern, "i").test(blob)) {
        return { id: rule.id, label: rule.label };
      }
    } catch {
      /* bad pattern — ignore */
    }
  }
  return null;
}

/* ---------------------------------------------------------------- uploads */

function saveDataUrl(dataUrl, prefix) {
  const match = str(dataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  const contentType = match ? match[1] : "image/jpeg";
  const raw = match ? match[2] : str(dataUrl).replace(/^data:image\/\w+;base64,/, "");
  if (!raw) throw new Error("Invalid image");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safePrefix = str(prefix || "img").replace(/[^\w.-]/g, "_");
  const name = `${safePrefix}_${Date.now()}.${ext}`;
  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(raw, "base64"));
  return `/uploads/${name}`;
}

/** Best-effort unlink of a previously saved /uploads/... path. */
function removeUpload(url) {
  const rel = str(url).trim();
  if (!rel.startsWith("/uploads/")) return;
  const name = path.basename(rel);
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, name));
  } catch {
    /* already gone */
  }
}

/* ------------------------------------------------------------- misc utils */

function uniq(list) {
  return [...new Set(list)];
}

function sortByCode(a, b) {
  return String(a.code || "").localeCompare(String(b.code || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Sequential document number, e.g. TR-2026-0007. */
function formNo(prefix, id, date = new Date()) {
  return `${prefix}-${date.getFullYear()}-${String(id).padStart(4, "0")}`;
}

module.exports = {
  UPLOAD_DIR,
  PUBLIC_BASE,
  TOOL_PREFIXES,
  DIRECTIONS,
  PPE_RULES,
  PPE_COOLDOWN_DAYS,
  ensureUploadDir,
  str,
  trimmed,
  upper,
  num,
  int,
  posInt,
  bool,
  asArray,
  nullableDate,
  pad2,
  rowDateOf,
  rowDateNow,
  stripBraces,
  parseRowDate,
  fmtDate,
  fmtDateTime,
  isoOrNull,
  isoDateOnly,
  daysSince,
  daysUntil,
  isPersonCode,
  isDirection,
  isToolCode,
  isConsumableCode,
  kindForCode,
  matchPpeFamily,
  saveDataUrl,
  removeUpload,
  uniq,
  sortByCode,
  formNo,
};
