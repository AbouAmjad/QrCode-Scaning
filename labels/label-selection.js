/**
 * label-selection.js — Multi-select, resize, rotate, duplicate, lock/hide.
 */
import { roundMm, clamp, uid } from "./label-units.js";
import { contentBox, clampLayerMm, snapMm } from "./label-layout-engine.js";

export class SelectionManager {
  constructor() {
    this.ids = new Set();
  }

  get selectedIds() {
    return [...this.ids];
  }

  clear() {
    this.ids.clear();
  }

  set(ids) {
    this.ids = new Set(ids.filter(Boolean));
  }

  toggle(id, additive = false) {
    if (!additive) {
      this.ids = new Set(id ? [id] : []);
      return;
    }
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
  }

  has(id) {
    return this.ids.has(id);
  }

  selectAll(layers) {
    this.ids = new Set((layers || []).filter((l) => !l.locked).map((l) => l.id));
  }

  selectedLayers(layers) {
    return (layers || []).filter((l) => this.ids.has(l.id));
  }

  duplicate(layers) {
    const selected = this.selectedLayers(layers);
    const copies = selected.map((ly) => ({
      ...JSON.parse(JSON.stringify(ly)),
      id: uid("ly"),
      name: `${ly.name || ly.type} copy`,
      x: roundMm(Number(ly.x) + 2),
      y: roundMm(Number(ly.y) + 2),
      locked: false,
      z: (Number(ly.z) || 0) + 1
    }));
    this.set(copies.map((c) => c.id));
    return [...layers, ...copies];
  }

  deleteSelected(layers) {
    const next = (layers || []).filter((l) => !this.ids.has(l.id) || l.locked);
    this.clear();
    return next;
  }

  setLocked(layers, locked) {
    return (layers || []).map((l) =>
      this.ids.has(l.id) ? { ...l, locked: !!locked } : l
    );
  }

  setVisible(layers, visible) {
    return (layers || []).map((l) =>
      this.ids.has(l.id) ? { ...l, visible: !!visible } : l
    );
  }

  rename(layers, id, name) {
    return (layers || []).map((l) =>
      l.id === id ? { ...l, name: String(name || l.name) } : l
    );
  }

  nudge(layers, dxMm, dyMm, template, gridMm = 0) {
    const box = contentBox(template);
    return (layers || []).map((l) => {
      if (!this.ids.has(l.id) || l.locked) return l;
      let x = Number(l.x) + dxMm;
      let y = Number(l.y) + dyMm;
      if (gridMm > 0) {
        x = snapMm(x, gridMm);
        y = snapMm(y, gridMm);
      }
      return clampLayerMm({ ...l, x, y, unit: "mm" }, box);
    });
  }

  /**
   * Apply resize from a handle.
   * handle: nw|n|ne|e|se|s|sw|w
   */
  resize(layers, id, handle, dxMm, dyMm, template, keepAspect = false) {
    const box = contentBox(template);
    return (layers || []).map((l) => {
      if (l.id !== id || l.locked) return l;
      let { x, y, w, h } = l;
      x = Number(x);
      y = Number(y);
      w = Number(w);
      h = Number(h);
      const aspect = w / Math.max(0.01, h);

      if (handle.includes("e")) w = Math.max(0.5, w + dxMm);
      if (handle.includes("s")) h = Math.max(0.5, h + dyMm);
      if (handle.includes("w")) {
        const nw = Math.max(0.5, w - dxMm);
        x += w - nw;
        w = nw;
      }
      if (handle.includes("n")) {
        const nh = Math.max(0.5, h - dyMm);
        y += h - nh;
        h = nh;
      }
      if (keepAspect && (handle.length === 2)) {
        h = Math.max(0.5, w / aspect);
      }
      return clampLayerMm({ ...l, x, y, w, h, unit: "mm" }, box);
    });
  }

  rotate(layers, id, degrees) {
    return (layers || []).map((l) => {
      if (l.id !== id || l.locked) return l;
      let rot = (Number(l.rotation) || 0) + degrees;
      rot = ((rot % 360) + 360) % 360;
      return { ...l, rotation: roundMm(rot, 1) };
    });
  }

  /** Group selected layers under one groupId. */
  group(layers) {
    const gid = uid("grp");
    const ids = this.selectedIds;
    if (ids.length < 2) return layers;
    return (layers || []).map((l) =>
      ids.includes(l.id) ? { ...l, groupId: gid } : l
    );
  }

  ungroup(layers) {
    const ids = this.selectedIds;
    return (layers || []).map((l) =>
      ids.includes(l.id) ? { ...l, groupId: null } : l
    );
  }

  reorder(layers, id, direction) {
    const arr = [...(layers || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
    const idx = arr.findIndex((l) => l.id === id);
    if (idx < 0) return layers;
    const swapWith =
      direction === "up" ? idx + 1 : direction === "down" ? idx - 1 : direction === "top" ? arr.length - 1 : 0;
    if (swapWith < 0 || swapWith >= arr.length) return layers;
    if (direction === "top" || direction === "bottom") {
      const [item] = arr.splice(idx, 1);
      if (direction === "top") arr.push(item);
      else arr.unshift(item);
    } else {
      const tmp = arr[idx];
      arr[idx] = arr[swapWith];
      arr[swapWith] = tmp;
    }
    return arr.map((l, i) => ({ ...l, z: i + 1 }));
  }
}

export default SelectionManager;
