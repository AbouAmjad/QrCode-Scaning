/**
 * Element registry — add new element types without touching the core engine.
 * Each definition: { type, label, defaults(), paint(nodeCtx) optional overrides }
 */
const registry = new Map();

export function registerElement(def) {
  if (!def?.type) throw new Error("Element definition requires type");
  registry.set(def.type, def);
  return def;
}

export function getElementDef(type) {
  return registry.get(type) || null;
}

export function listElementTypes() {
  return [...registry.keys()];
}

export function getAllElementDefs() {
  return [...registry.values()];
}
