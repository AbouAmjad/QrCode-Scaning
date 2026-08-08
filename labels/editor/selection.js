/**
 * editor/selection.js — selection set + pure transforms on layers.
 */
import { createId } from "../core/id.js";
import { roundMm } from "../core/units.js";
import { contentBox, clampLayerMm, snapMm } from "../layout/index.js";

export class SelectionModel {
  constructor() {
    this.ids = new Set();
    this._listeners = new Set();
  }

  get selectedIds() {
    return [...this.ids];
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn(this.selectedIds);
      } catch (e) {
        console.error("[SelectionModel] listener error", e);
      }
    }
  }

  clear() {
    this.ids.clear();
    this._emit();
  }

  set(ids, additive = false) {
    if (additive && ids?.length) {
      for (const id of ids) {
        if (this.ids.has(id)) this.ids.delete(id);
        else this.ids.add(id);
      }
    } else {
      this.ids = new Set((ids || []).filter(Boolean));
    }
    this._emit();
  }

  toggle(id, additive = false) {
    if (!additive) {
      this.ids = new Set(id ? [id] : []);
    } else if (this.ids.has(id)) {
      this.ids.delete(id);
    } else {
      this.ids.add(id);
    }
    this._emit();
  }

  has(id) {
    return this.ids.has(id);
  }

  selectAll(layers) {
    this.ids = new Set((layers || []).filter((l) => !l.locked).map((l) => l.id));
    this._emit();
  }

  selected(layers) {
    return (layers || []).filter((l) => this.ids.has(l.id));
  }

  duplicate(layers) {
    const copies = this.selected(layers).map((ly) => ({
      ...JSON.parse(JSON.stringify(ly)),
      id: createId("ly"),
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

  nudge(layers, dx, dy, doc, gridMm = 0) {
    const box = contentBox(doc);
    return (layers || []).map((l) => {
      if (!this.ids.has(l.id) || l.locked) return l;
      let x = Number(l.x) + dx;
      let y = Number(l.y) + dy;
      if (gridMm > 0) {
        x = snapMm(x, gridMm);
        y = snapMm(y, gridMm);
      }
      return clampLayerMm({ ...l, x, y, unit: "mm" }, box);
    });
  }

  resize(layers, id, handle, dx, dy, doc, keepAspect = false) {
    const box = contentBox(doc);
    return (layers || []).map((l) => {
      if (l.id !== id || l.locked) return l;
      let { x, y, w, h } = l;
      x = Number(x);
      y = Number(y);
      w = Number(w);
      h = Number(h);
      const aspect = w / Math.max(0.01, h);
      if (handle.includes("e")) w = Math.max(0.5, w + dx);
      if (handle.includes("s")) h = Math.max(0.5, h + dy);
      if (handle.includes("w")) {
        const nw = Math.max(0.5, w - dx);
        x += w - nw;
        w = nw;
      }
      if (handle.includes("n")) {
        const nh = Math.max(0.5, h - dy);
        y += h - nh;
        h = nh;
      }
      if (keepAspect && handle.length === 2) h = Math.max(0.5, w / aspect);
      return clampLayerMm({ ...l, x, y, w, h, unit: "mm" }, box);
    });
  }

  reorder(layers, id, direction) {
    const arr = [...(layers || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
    const idx = arr.findIndex((l) => l.id === id);
    if (idx < 0) return layers;
    if (direction === "top" || direction === "bottom") {
      const [item] = arr.splice(idx, 1);
      if (direction === "top") arr.push(item);
      else arr.unshift(item);
    } else {
      const swapWith = direction === "up" ? idx + 1 : idx - 1;
      if (swapWith < 0 || swapWith >= arr.length) return layers;
      const tmp = arr[idx];
      arr[idx] = arr[swapWith];
      arr[swapWith] = tmp;
    }
    return arr.map((l, i) => ({ ...l, z: i + 1 }));
  }

  group(layers) {
    const ids = this.selectedIds;
    if (ids.length < 2) return layers;
    const gid = createId("grp");
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
}
