/**
 * data/serialize.js — pure document ↔ JSON (testable without DOM).
 */
import { createDocument } from "../core/document.js";

export function serializeDocument(doc) {
  return JSON.stringify(createDocument(doc));
}

export function deserializeDocument(raw) {
  if (raw == null) return createDocument();
  if (typeof raw === "object") return createDocument(raw);
  try {
    return createDocument(JSON.parse(String(raw)));
  } catch (e) {
    throw new Error("Invalid template JSON: " + (e.message || e));
  }
}

export function parseServerTemplate(item) {
  let cfg = item?.config;
  if (typeof cfg === "string") {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      cfg = {};
    }
  }
  return {
    id: item?.id ?? null,
    name: item?.name || "Untitled",
    document: createDocument(cfg || {})
  };
}
