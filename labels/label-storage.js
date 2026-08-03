/**
 * label-storage.js — Local preferences, last template, printer profiles.
 */
const KEYS = {
  lastTpl: "tc_last_label_tpl_id",
  calibration: "abouamjad_printer_calibration_v1",
  profiles: "abouamjad_printer_profiles_v1",
  activeProfile: "abouamjad_active_printer_v1",
  studioZoom: "abouamjad_label_studio_zoom_v1",
  gridMm: "abouamjad_label_grid_mm_v1"
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function getLastTemplateId() {
  return Number(localStorage.getItem(KEYS.lastTpl) || 0) || null;
}

export function setLastTemplateId(id) {
  if (id == null) localStorage.removeItem(KEYS.lastTpl);
  else localStorage.setItem(KEYS.lastTpl, String(id));
}

export function defaultCalibration() {
  return {
    printerName: "default",
    dpi: 300,
    offsetXMm: 0,
    offsetYMm: 0,
    scale: 1,
    feedMm: 0
  };
}

export function loadCalibration() {
  return { ...defaultCalibration(), ...readJson(KEYS.calibration, {}) };
}

export function saveCalibration(cal) {
  const next = { ...defaultCalibration(), ...cal };
  writeJson(KEYS.calibration, next);
  // Also mirror into active profile
  const name = next.printerName || "default";
  const profiles = listPrinterProfiles();
  profiles[name] = { ...next };
  writeJson(KEYS.profiles, profiles);
  localStorage.setItem(KEYS.activeProfile, name);
  return next;
}

export function listPrinterProfiles() {
  return readJson(KEYS.profiles, {
    default: defaultCalibration(),
    ITPP130: {
      printerName: "ITPP130",
      dpi: 203,
      offsetXMm: 0,
      offsetYMm: 0,
      scale: 1,
      feedMm: 0
    }
  });
}

export function getActivePrinterName() {
  return localStorage.getItem(KEYS.activeProfile) || "default";
}

export function setActivePrinter(name) {
  const profiles = listPrinterProfiles();
  const profile = profiles[name] || { ...defaultCalibration(), printerName: name };
  localStorage.setItem(KEYS.activeProfile, name);
  return saveCalibration(profile);
}

export function savePrinterProfile(name, cal) {
  const profiles = listPrinterProfiles();
  profiles[name] = { ...defaultCalibration(), ...cal, printerName: name };
  writeJson(KEYS.profiles, profiles);
  return profiles[name];
}

export function getStudioZoom() {
  const z = Number(localStorage.getItem(KEYS.studioZoom));
  return z > 0 ? z : 1;
}

export function setStudioZoom(z) {
  localStorage.setItem(KEYS.studioZoom, String(z));
}

export function getGridMm() {
  const g = Number(localStorage.getItem(KEYS.gridMm));
  return g > 0 ? g : 1;
}

export function setGridMm(g) {
  localStorage.setItem(KEYS.gridMm, String(g));
}

export default {
  getLastTemplateId,
  setLastTemplateId,
  loadCalibration,
  saveCalibration,
  defaultCalibration,
  listPrinterProfiles,
  getActivePrinterName,
  setActivePrinter,
  savePrinterProfile,
  getStudioZoom,
  setStudioZoom,
  getGridMm,
  setGridMm
};
