/**
 * Design Studio — professional label editor.
 * Presentation only: document lives in DocumentStore; paint via renderLabel only.
 */
import { DocumentStore } from "../core/store.js";
import { cloneDocument } from "../core/document.js";
import { createLayer, layoutPresets } from "../elements/create.js";
import { listElementTypes } from "../elements/registry.js";
import { contentBox } from "../layout/box.js";
import { snapPosition } from "../layout/snap.js";
import { alignLayers, distributeLayers } from "../layout/align.js";
import { renderLabel, ensureQrLibrary } from "../render/engine.js";
import { getStudioZoom, setStudioZoom } from "../data/storage.js";
import { Viewport } from "./viewport.js";
import { SelectionModel } from "./selection.js";
import { GuidesPainter } from "./guides.js";
import { bindShortcuts } from "./shortcuts.js";
import { cssMmToPxFactor } from "../core/units.js";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * @param {HTMLElement} root  #editorHost
 * @param {{
 *   onChange?: (doc: object) => void,
 *   onSave?: (doc: object) => void|Promise<void>,
 *   onSaveAs?: (doc: object) => void|Promise<void>
 * }} [opts]
 */
export class LabelStudio {
  constructor(root, { onChange, onSave, onSaveAs } = {}) {
    this.root = root;
    this.onChange = onChange;
    this.onSave = onSave;
    this.onSaveAs = onSaveAs;
    this.store = new DocumentStore();
    this.selection = new SelectionModel();
    this.viewport = new Viewport({ zoom: getStudioZoom() });
    this.guides = new GuidesPainter();
    this._open = false;
    this._drag = null;
    this._clipboard = [];
    this._raf = 0;
    this._space = false;
    this._unsub = [];

    this.root.innerHTML = studioMarkup();
    this.el = {
      studio: this.root.querySelector(".le-studio"),
      meta: this.root.querySelector("[data-meta]"),
      zoom: this.root.querySelector("[data-zoom]"),
      layers: this.root.querySelector("[data-layers]"),
      inspector: this.root.querySelector("[data-inspector]"),
      status: this.root.querySelector("[data-status]"),
      wrap: this.root.querySelector("[data-wrap]"),
      stage: this.root.querySelector("[data-stage]"),
      host: this.root.querySelector("[data-label-host]"),
      canvas: this.root.querySelector("[data-guides]"),
      handles: this.root.querySelector("[data-handles]"),
      rulerH: this.root.querySelector("[data-ruler-h]"),
      rulerV: this.root.querySelector("[data-ruler-v]")
    };

    this._wireChrome();
    this._unbindKeys = bindShortcuts(
      {
        undo: () => this.undo(),
        redo: () => this.redo(),
        copy: () => this.copy(),
        cut: () => this.cut(),
        paste: () => this.paste(),
        duplicate: () => this.duplicate(),
        delete: () => this.deleteSelected(),
        selectAll: () => {
          this.selection.selectAll(this.doc.layers);
          this.schedulePaint(false);
        },
        group: () => {
          this.store.update((d) => {
            d.layers = this.selection.group(d.layers);
          }, "group");
        },
        ungroup: () => {
          this.store.update((d) => {
            d.layers = this.selection.ungroup(d.layers);
          }, "ungroup");
        },
        nudge: (dx, dy) => {
          this.store.update((d) => {
            d.layers = this.selection.nudge(
              d.layers,
              dx,
              dy,
              d,
              d.snapToGrid ? d.gridMm : 0
            );
          }, "nudge");
        },
        zoom: (dir) => this.nudgeZoom(dir),
        save: () => {
          void this.save();
        }
      },
      { isEnabled: () => this._open }
    );

    this._unsub.push(
      this.store.subscribe(() => {
        this.onChange?.(cloneDocument(this.doc));
        this.schedulePaint(true);
      })
    );
    this._unsub.push(this.selection.subscribe(() => this.schedulePaint(false)));
  }

  get doc() {
    return this.store.get();
  }

  get isOpen() {
    return this._open;
  }

  async open(partial) {
    await ensureQrLibrary().catch((e) => console.warn("[studio] QR lib", e));
    this.store.reset(partial || {}, "open");
    this.selection.clear();
    this.viewport.setZoom(getStudioZoom());
    this._open = true;
    this.el.studio.hidden = false;
    this.el.studio.classList.add("open");
    requestAnimationFrame(() => {
      this.viewport.fit(
        this.el.wrap.clientWidth,
        this.el.wrap.clientHeight,
        this.doc.labelW,
        this.doc.labelH
      );
      this.paint();
    });
  }

  close(save = true) {
    if (!this._open) return;
    if (save) this.onChange?.(cloneDocument(this.doc));
    this._open = false;
    this.el.studio.hidden = true;
    this.el.studio.classList.remove("open");
  }

  /** Persist current document via host callbacks (does not close the studio). */
  async save(forceNew = false) {
    if (!this._open) return;
    const doc = cloneDocument(this.doc);
    this.onChange?.(doc);
    const fn = forceNew ? this.onSaveAs || this.onSave : this.onSave;
    if (!fn) return;
    await fn(doc);
  }

  undo() {
    this.store.undo();
  }

  redo() {
    this.store.redo();
  }

  schedulePaint(full = true) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.paint(full);
    });
  }

  async paint(full = true) {
    if (!this._open) return;
    const doc = this.doc;
    this.el.meta.textContent = `${doc.labelW}×${doc.labelH} mm · ${doc.page}`;
    this.el.zoom.textContent = `${this.viewport.zoomPercent()}%`;

    const scale = this.viewport.zoom === "fit" ? 1 : Number(this.viewport.zoom) || 1;
    const pxPerMm = cssMmToPxFactor(96) * scale;

    this.el.stage.style.width = `${doc.labelW}mm`;
    this.el.stage.style.height = `${doc.labelH}mm`;
    this.el.stage.style.transform = this.viewport.cssTransform();

    if (full) {
      this.el.host.innerHTML = "";
      try {
        const node = await renderLabel(doc, { code: "SAMPLE", name: "Preview" }, {
          mode: "editor",
          interactive: true,
          applyCalibration: false
        });
        this.el.host.appendChild(node);
      } catch (e) {
        console.error("[studio] render failed", e);
        this.el.status.textContent = `Render error: ${e.message || e}`;
      }
    }

    this.guides.paint(this.el.canvas.getContext("2d"), doc, pxPerMm);
    this.guides.paintRulers(this.el.rulerH, this.el.rulerV, doc, pxPerMm);
    this.paintHandles(doc, pxPerMm);
    this.paintLayers();
    this.paintInspector();
    this.paintStatus();
  }

  paintHandles(doc) {
    const host = this.el.handles;
    host.innerHTML = "";
    const selected = this.selection.selected(doc.layers).filter((l) => l.visible !== false);
    for (const ly of selected) {
      const box = document.createElement("div");
      box.className = "le-sel-box";
      box.style.left = `${ly.x}mm`;
      box.style.top = `${ly.y}mm`;
      box.style.width = `${ly.w}mm`;
      box.style.height = `${ly.h}mm`;
      if (ly.rotation) box.style.transform = `rotate(${ly.rotation}deg)`;
      host.appendChild(box);

      if (selected.length === 1 && !ly.locked) {
        for (const h of HANDLES) {
          const handle = document.createElement("div");
          handle.className = `le-hnd le-hnd-${h}`;
          handle.dataset.handle = h;
          handle.dataset.layerId = ly.id;
          host.appendChild(handle);
          positionHandle(handle, ly, h);
        }
        const rot = document.createElement("div");
        rot.className = "le-hnd le-hnd-rot";
        rot.dataset.handle = "rot";
        rot.dataset.layerId = ly.id;
        rot.style.left = `calc(${ly.x + ly.w / 2}mm - 5px)`;
        rot.style.top = `calc(${ly.y}mm - 22px)`;
        host.appendChild(rot);
      }
    }
  }

  paintLayers() {
    const doc = this.doc;
    const sorted = [...doc.layers].sort((a, b) => (b.z || 0) - (a.z || 0));
    this.el.layers.innerHTML = `<div class="rail-ttl">Layers</div>`;
    for (const ly of sorted) {
      const row = document.createElement("div");
      row.className = "le-layer" + (this.selection.has(ly.id) ? " active" : "");
      row.innerHTML = `
        <button type="button" data-act="vis" title="Visibility">${ly.visible === false ? "○" : "●"}</button>
        <button type="button" data-act="lock" title="Lock">${ly.locked ? "🔒" : "🔓"}</button>
        <span class="name">${escapeHtml(ly.name || ly.type)}</span>
        <button type="button" data-act="up" title="Bring forward">↑</button>
        <button type="button" data-act="down" title="Send backward">↓</button>
        <button type="button" data-act="del" title="Delete layer" ${ly.locked ? "disabled" : ""}>✕</button>`;
      row.addEventListener("click", (e) => {
        const act = e.target?.dataset?.act;
        if (act === "vis") {
          this.store.update((d) => {
            const t = d.layers.find((x) => x.id === ly.id);
            if (t) t.visible = t.visible === false;
          }, "visibility");
          return;
        }
        if (act === "lock") {
          this.store.update((d) => {
            const t = d.layers.find((x) => x.id === ly.id);
            if (t) t.locked = !t.locked;
          }, "lock");
          return;
        }
        if (act === "up" || act === "down") {
          this.store.update((d) => {
            d.layers = this.selection.reorder(d.layers, ly.id, act);
          }, "reorder");
          return;
        }
        if (act === "del") {
          if (ly.locked) return;
          this.selection.set([ly.id]);
          this.deleteSelected();
          return;
        }
        this.selection.toggle(ly.id, e.shiftKey);
      });
      this.el.layers.appendChild(row);
    }
  }

  paintInspector() {
    const selected = this.selection.selected(this.doc.layers);
    if (!selected.length) {
      this.el.inspector.innerHTML = `<p class="lp-empty">Select an element</p>`;
      return;
    }
    if (selected.length > 1) {
      this.el.inspector.innerHTML = `<p class="lp-empty">${selected.length} selected</p>`;
      return;
    }
    const ly = selected[0];
    this.el.inspector.innerHTML = `
      <div class="lp-fields">
        <label class="span-2">Name<input data-f="name" value="${escapeAttr(ly.name || "")}"></label>
        <label>X<input data-f="x" type="number" step="0.1" value="${ly.x}"></label>
        <label>Y<input data-f="y" type="number" step="0.1" value="${ly.y}"></label>
        <label>W<input data-f="w" type="number" step="0.1" value="${ly.w}"></label>
        <label>H<input data-f="h" type="number" step="0.1" value="${ly.h}"></label>
        <label>Rotate<input data-f="rotation" type="number" step="1" value="${ly.rotation || 0}"></label>
        <label>Opacity<input data-f="opacity" type="number" min="0" max="1" step="0.05" value="${ly.opacity ?? 1}"></label>
        ${typeFieldsHtml(ly)}
      </div>`;
    this.el.inspector.querySelectorAll("[data-f]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.f;
        let val = input.type === "number" ? Number(input.value) : input.value;
        this.store.update((d) => {
          const t = d.layers.find((x) => x.id === ly.id);
          if (!t) return;
          t[key] = val;
        }, "inspect");
      });
    });
  }

  paintStatus() {
    const selected = this.selection.selected(this.doc.layers);
    if (!selected.length) {
      this.el.status.textContent = "Ready · mm geometry · single renderer";
      return;
    }
    const ly = selected[0];
    this.el.status.textContent =
      selected.length === 1
        ? `${ly.name || ly.type} · x=${Number(ly.x).toFixed(1)} y=${Number(ly.y).toFixed(1)} · ${Number(ly.w).toFixed(1)}×${Number(ly.h).toFixed(1)} mm`
        : `${selected.length} objects selected`;
  }

  clientToContentMm(clientX, clientY) {
    const rect = this.el.stage.getBoundingClientRect();
    const doc = this.doc;
    const box = contentBox(doc);
    const x = ((clientX - rect.left) / rect.width) * doc.labelW - box.ox;
    const y = ((clientY - rect.top) / rect.height) * doc.labelH - box.oy;
    return { x, y };
  }

  hitTest(mm) {
    const layers = [...this.doc.layers]
      .filter((l) => l.visible !== false)
      .sort((a, b) => (b.z || 0) - (a.z || 0));
    for (const ly of layers) {
      if (mm.x >= ly.x && mm.x <= ly.x + ly.w && mm.y >= ly.y && mm.y <= ly.y + ly.h) {
        return ly;
      }
    }
    return null;
  }

  addLayer(type) {
    this.store.update((d) => {
      const ly = createLayer(type, {
        x: Math.max(d.innerMargin || 0, 2),
        y: Math.max(d.innerMargin || 0, 2)
      });
      d.layers.push(ly);
      this.selection.set([ly.id]);
    }, `add ${type}`);
  }

  deleteSelected() {
    this.store.update((d) => {
      d.layers = this.selection.deleteSelected(d.layers);
    }, "delete");
  }

  copy() {
    this._clipboard = this.selection.selected(this.doc.layers).map((l) => structuredClone(l));
  }

  cut() {
    this.copy();
    this.deleteSelected();
  }

  paste() {
    if (!this._clipboard.length) return;
    this.store.update((d) => {
      const ids = [];
      for (const src of this._clipboard) {
        const ly = createLayer(src.type, {
          ...structuredClone(src),
          id: undefined,
          x: Number(src.x) + 2,
          y: Number(src.y) + 2,
          locked: false
        });
        d.layers.push(ly);
        ids.push(ly.id);
      }
      this.selection.set(ids);
    }, "paste");
  }

  duplicate() {
    this.store.update((d) => {
      d.layers = this.selection.duplicate(d.layers);
    }, "duplicate");
  }

  align(mode) {
    this.store.update((d) => {
      const box = contentBox(d);
      const selected = this.selection.selected(d.layers).filter((l) => !l.locked);
      const aligned = alignLayers(selected, mode, box);
      const map = new Map(aligned.map((l) => [l.id, l]));
      d.layers = d.layers.map((l) => map.get(l.id) || l);
    }, `align ${mode}`);
  }

  distribute(axis) {
    this.store.update((d) => {
      const selected = this.selection.selected(d.layers).filter((l) => !l.locked);
      const dist = distributeLayers(selected, axis === "vertical" ? "v" : "h");
      const map = new Map(dist.map((l) => [l.id, l]));
      d.layers = d.layers.map((l) => map.get(l.id) || l);
    }, `distribute ${axis}`);
  }

  nudgeZoom(dir) {
    this.viewport.nudgeZoom(dir);
    setStudioZoom(this.viewport.zoom === "fit" ? 1 : this.viewport.zoom);
    this.schedulePaint(false);
  }

  setZoom(v) {
    this.viewport.setZoom(v);
    if (v === "fit") {
      this.viewport.fit(
        this.el.wrap.clientWidth,
        this.el.wrap.clientHeight,
        this.doc.labelW,
        this.doc.labelH
      );
    }
    setStudioZoom(this.viewport.zoom === "fit" ? 1 : this.viewport.zoom);
    this.schedulePaint(false);
  }

  applyPreset(name) {
    const presets = layoutPresets();
    const fn = presets[name];
    if (!fn) return;
    this.store.update((d) => {
      d.layers = fn();
    }, `preset ${name}`);
    this.selection.clear();
  }

  _wireChrome() {
    this.root.querySelector("[data-back]")?.addEventListener("click", () => this.close(true));
    this.root.querySelector("[data-done]")?.addEventListener("click", () => this.close(true));
    this.root.querySelector("[data-save]")?.addEventListener("click", () => {
      void this.save(false);
    });
    this.root.querySelector("[data-save-as]")?.addEventListener("click", () => {
      void this.save(true);
    });
    this.root.querySelector("[data-reset]")?.addEventListener("click", () => {
      this.store.update((d) => {
        d.layers = layoutPresets().thermal();
      }, "reset");
      this.selection.clear();
    });

    this.root.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => this._onTool(btn.dataset.tool));
    });

    const wrap = this.el.wrap;
    wrap.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    wrap.addEventListener("pointermove", (e) => this._onPointerMove(e));
    wrap.addEventListener("pointerup", (e) => this._onPointerUp(e));
    wrap.addEventListener("pointercancel", () => this._onPointerUp());
    wrap.addEventListener(
      "wheel",
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        this.viewport.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 1 / 1.08, wrap.getBoundingClientRect());
        setStudioZoom(this.viewport.zoom);
        this.schedulePaint(false);
      },
      { passive: false }
    );

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && this._open) this._space = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this._space = false;
    });
  }

  _onTool(tool) {
    if (tool === "delete") {
      this.deleteSelected();
      return;
    }
    if (tool === "copy") return this.copy();
    if (tool === "cut") return this.cut();
    if (tool === "paste") return this.paste();
    if (tool === "duplicate") return this.duplicate();
    if (tool === "group") {
      this.store.update((d) => {
        d.layers = this.selection.group(d.layers);
      }, "group");
      return;
    }
    if (tool === "ungroup") {
      this.store.update((d) => {
        d.layers = this.selection.ungroup(d.layers);
      }, "ungroup");
      return;
    }
    if (tool === "select" || tool === "hand") {
      this.viewport.tool = tool;
      this.root.querySelectorAll("[data-tool=select],[data-tool=hand]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.tool === tool);
      });
      return;
    }
    if (listElementTypes().includes(tool)) {
      this.addLayer(tool);
      return;
    }
    const alignMap = {
      "align-left": "left",
      "align-right": "right",
      "align-top": "top",
      "align-bottom": "bottom",
      "align-h": "centerH",
      "align-v": "centerV",
      "align-label-h": "centerLabelH",
      "align-label-v": "centerLabelV"
    };
    if (alignMap[tool]) return this.align(alignMap[tool]);
    if (tool === "dist-h") return this.distribute("horizontal");
    if (tool === "dist-v") return this.distribute("vertical");
    if (tool === "zoom-in") return this.nudgeZoom(1);
    if (tool === "zoom-out") return this.nudgeZoom(-1);
    if (tool === "zoom-fit") return this.setZoom("fit");
    if (tool === "grid") {
      this.store.update((d) => {
        d.showGuides = !d.showGuides;
      }, "toggle grid");
      return;
    }
    if (tool === "snap") {
      this.store.update((d) => {
        d.snapToGrid = !d.snapToGrid;
      }, "toggle snap");
      return;
    }
    if (tool === "undo") return this.undo();
    if (tool === "redo") return this.redo();
    if (tool.startsWith("preset-")) return this.applyPreset(tool.slice(7));
  }

  _onPointerDown(e) {
    if (!this._open || e.button !== 0) return;
    if (this._space || this.viewport.tool === "hand") {
      this._drag = {
        kind: "pan",
        x: e.clientX,
        y: e.clientY,
        panX: this.viewport.panX,
        panY: this.viewport.panY
      };
      this.el.wrap.setPointerCapture(e.pointerId);
      return;
    }

    const handle = e.target?.closest?.("[data-handle]");
    if (handle) {
      const ly = this.doc.layers.find((l) => l.id === handle.dataset.layerId);
      if (!ly || ly.locked) return;
      this._drag = {
        kind: handle.dataset.handle === "rot" ? "rotate" : "resize",
        handle: handle.dataset.handle,
        id: ly.id,
        start: this.clientToContentMm(e.clientX, e.clientY),
        origin: { ...ly }
      };
      this.el.wrap.setPointerCapture(e.pointerId);
      return;
    }

    const mm = this.clientToContentMm(e.clientX, e.clientY);
    const hit = this.hitTest(mm);
    if (!hit) {
      this.selection.clear();
      return;
    }
    if (!this.selection.has(hit.id)) this.selection.set([hit.id], e.shiftKey);
    if (hit.locked) return;
    const origins = this.selection.selected(this.doc.layers).map((l) => ({
      id: l.id,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h
    }));
    this._drag = { kind: "move", start: mm, origins };
    this.el.wrap.setPointerCapture(e.pointerId);
  }

  _onPointerMove(e) {
    if (!this._drag) return;
    if (this._drag.kind === "pan") {
      this.viewport.panX = this._drag.panX + (e.clientX - this._drag.x);
      this.viewport.panY = this._drag.panY + (e.clientY - this._drag.y);
      this.el.stage.style.transform = this.viewport.cssTransform();
      return;
    }

    const mm = this.clientToContentMm(e.clientX, e.clientY);
    const doc = this.doc;
    const box = contentBox(doc);

    if (this._drag.kind === "move") {
      this._liveMove(mm.x - this._drag.start.x, mm.y - this._drag.start.y, box);
      return;
    }

    if (this._drag.kind === "resize") {
      this._liveResize(
        this._drag.id,
        this._drag.handle,
        mm.x - this._drag.start.x,
        mm.y - this._drag.start.y
      );
      return;
    }

    if (this._drag.kind === "rotate") {
      const o = this._drag.origin;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const ang = (Math.atan2(mm.y - cy, mm.x - cx) * 180) / Math.PI + 90;
      this._livePatch(this._drag.id, { rotation: Math.round(ang) });
    }
  }

  _liveMove(dx, dy, box) {
    const draft = cloneDocument(this.doc);
    for (const o of this._drag.origins) {
      const t = draft.layers.find((x) => x.id === o.id);
      if (!t) continue;
      const others = draft.layers.filter((x) => x.id !== o.id);
      const snapped = snapPosition(o.x + dx, o.y + dy, t.w, t.h, box, others, {
        gridMm: draft.gridMm,
        snapToGrid: draft.snapToGrid,
        snapToObjects: draft.snapToObjects
      });
      t.x = snapped.x;
      t.y = snapped.y;
      if (o === this._drag.origins[0]) this.guides.setSmartGuides(snapped.guides);
    }
    this.store.replaceQuiet(draft);
    this.schedulePaint(false);
  }

  _liveResize(id, handle, dx, dy) {
    const draft = cloneDocument(this.doc);
    const origin = this._drag.origin;
    draft.layers = draft.layers.map((l) => {
      if (l.id !== id) return l;
      let { x, y, w, h } = origin;
      x = Number(x);
      y = Number(y);
      w = Number(w);
      h = Number(h);
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
      return { ...l, x, y, w, h };
    });
    this.store.replaceQuiet(draft);
    this.schedulePaint(false);
  }

  _livePatch(id, patch) {
    const draft = cloneDocument(this.doc);
    draft.layers = draft.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
    this.store.replaceQuiet(draft);
    this.schedulePaint(false);
  }

  _onPointerUp() {
    if (!this._drag) return;
    const kind = this._drag.kind;
    this._drag = null;
    this.guides.clearSmartGuides();
    if (kind === "pan") return;
    this.store.commit(this.store.get(), kind);
  }

  destroy() {
    this._unbindKeys?.();
    this._unsub.forEach((u) => u());
    this.root.innerHTML = "";
  }
}

function positionHandle(el, ly, h) {
  const map = {
    nw: [`calc(${ly.x}mm - 5px)`, `calc(${ly.y}mm - 5px)`],
    n: [`calc(${ly.x + ly.w / 2}mm - 4px)`, `calc(${ly.y}mm - 5px)`],
    ne: [`calc(${ly.x + ly.w}mm - 5px)`, `calc(${ly.y}mm - 5px)`],
    e: [`calc(${ly.x + ly.w}mm - 5px)`, `calc(${ly.y + ly.h / 2}mm - 4px)`],
    se: [`calc(${ly.x + ly.w}mm - 5px)`, `calc(${ly.y + ly.h}mm - 5px)`],
    s: [`calc(${ly.x + ly.w / 2}mm - 4px)`, `calc(${ly.y + ly.h}mm - 5px)`],
    sw: [`calc(${ly.x}mm - 5px)`, `calc(${ly.y + ly.h}mm - 5px)`],
    w: [`calc(${ly.x}mm - 5px)`, `calc(${ly.y + ly.h / 2}mm - 4px)`]
  };
  const [left, top] = map[h] || map.se;
  el.style.left = left;
  el.style.top = top;
}

function typeFieldsHtml(ly) {
  if (ly.type === "text") {
    return `
      <label class="span-2">Text<textarea data-f="text" rows="2">${escapeHtml(ly.text || "")}</textarea></label>
      <label>Font pt<input data-f="font" type="number" step="0.5" value="${ly.font || 10}"></label>
      <label>Weight<input data-f="weight" type="number" step="100" value="${ly.weight || 700}"></label>
      <label>Align<select data-f="align">
        <option value="left" ${ly.align === "left" ? "selected" : ""}>left</option>
        <option value="center" ${ly.align === "center" ? "selected" : ""}>center</option>
        <option value="right" ${ly.align === "right" ? "selected" : ""}>right</option>
      </select></label>
      <label>Color<input data-f="color" type="color" value="${escapeAttr(ly.color || "#0f172a")}"></label>
      <label>Role<select data-f="role">
        <option value="" ${!ly.role ? "selected" : ""}>—</option>
        <option value="brand" ${ly.role === "brand" ? "selected" : ""}>brand</option>
        <option value="code" ${ly.role === "code" ? "selected" : ""}>code</option>
        <option value="desc" ${ly.role === "desc" ? "selected" : ""}>desc</option>
      </select></label>`;
  }
  if (ly.type === "qr") {
    return `
      <label>Style<select data-f="style">
        <option value="square" ${ly.style === "square" ? "selected" : ""}>square</option>
        <option value="rounded" ${ly.style === "rounded" ? "selected" : ""}>rounded</option>
        <option value="dots" ${ly.style === "dots" ? "selected" : ""}>dots</option>
      </select></label>
      <label>Color<input data-f="color" type="color" value="${escapeAttr(ly.color || "#0f172a")}"></label>
      <label>BG<input data-f="bg" type="color" value="${escapeAttr(ly.bg || "#ffffff")}"></label>
      <label>ECC<select data-f="errorCorrection">
        ${["L", "M", "Q", "H"]
          .map((v) => `<option value="${v}" ${ly.errorCorrection === v ? "selected" : ""}>${v}</option>`)
          .join("")}
      </select></label>`;
  }
  if (ly.type === "shape") {
    return `
      <label>Shape<select data-f="shape">
        <option value="rect" ${ly.shape === "rect" ? "selected" : ""}>rect</option>
        <option value="ellipse" ${ly.shape === "ellipse" ? "selected" : ""}>ellipse</option>
      </select></label>
      <label>Fill<input data-f="fill" type="color" value="${escapeAttr(ly.fill || "#e2e8f0")}"></label>
      <label>Stroke<input data-f="stroke" type="color" value="${escapeAttr(ly.stroke || "#0f172a")}"></label>
      <label>Stroke mm<input data-f="strokeWidth" type="number" step="0.05" value="${ly.strokeWidth || 0.2}"></label>`;
  }
  if (ly.type === "image") {
    return `<label class="span-2">Image URL<input data-f="src" value="${escapeAttr(ly.src || "")}"></label>`;
  }
  if (ly.type === "line") {
    return `
      <label>Stroke<input data-f="stroke" type="color" value="${escapeAttr(ly.stroke || "#0f172a")}"></label>
      <label>Width mm<input data-f="strokeWidth" type="number" step="0.05" value="${ly.strokeWidth || 0.35}"></label>`;
  }
  return "";
}

function studioLabel(key, en, ar) {
  try {
    if (typeof TCI18N !== "undefined" && TCI18N.t) {
      const v = TCI18N.t(key);
      if (v && v !== key) return v;
    }
  } catch {
    /* ignore */
  }
  const lang =
    (typeof document !== "undefined" && document.documentElement?.lang) || "en";
  return lang === "ar" ? ar || en : en;
}

function studioMarkup() {
  const back = studioLabel("studioBack", "Back", "رجوع");
  const reset = studioLabel("studioReset", "Reset", "إعادة ضبط");
  const save = studioLabel("saveDesign", "Save design", "حفظ التصميم");
  const saveAs = studioLabel("saveAsTemplate", "Save as…", "حفظ باسم…");
  const done = studioLabel("studioDone", "Done", "تم");
  const title = studioLabel("designStudio", "Design Studio", "استوديو التصميم");
  const backIcon =
    (typeof document !== "undefined" && document.documentElement?.lang === "ar")
      ? "bi-arrow-right"
      : "bi-arrow-left";
  return `
    <div class="le-studio" hidden>
      <header class="le-head">
        <div class="le-head-title">
          <button type="button" class="le-btn le-btn-ghost" data-back title="${escapeAttr(back)}">
            <i class="bi ${backIcon}"></i> ${escapeHtml(back)}
          </button>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <div class="meta" data-meta>50×30 mm</div>
          </div>
        </div>
        <div class="le-head-actions">
          <button type="button" class="le-btn" data-reset title="${escapeAttr(reset)}">
            <i class="bi bi-arrow-counterclockwise"></i> ${escapeHtml(reset)}
          </button>
          <button type="button" class="le-btn" data-save-as title="${escapeAttr(saveAs)}">
            <i class="bi bi-files"></i> ${escapeHtml(saveAs)}
          </button>
          <button type="button" class="le-btn le-btn-save" data-save title="${escapeAttr(save)} (Ctrl+S)">
            <i class="bi bi-save-fill"></i> ${escapeHtml(save)}
          </button>
          <button type="button" class="le-btn le-btn-accent" data-done id="leDone" title="${escapeAttr(done)}">
            <i class="bi bi-check2"></i> ${escapeHtml(done)}
          </button>
        </div>
      </header>
      <div class="lt-toolbar">
        <div class="lt-group">
          <button type="button" data-tool="select" class="is-active" title="Select (V)">Select</button>
          <button type="button" data-tool="hand" title="Hand (H)">Hand</button>
        </div>
        <div class="lt-group">
          <button type="button" data-tool="qr">+ QR</button>
          <button type="button" data-tool="text">+ Text</button>
          <button type="button" data-tool="image">+ Image</button>
          <button type="button" data-tool="shape">+ Shape</button>
          <button type="button" data-tool="line">+ Line</button>
        </div>
        <div class="lt-group">
          <button type="button" data-tool="copy" title="Copy (Ctrl+C)">Copy</button>
          <button type="button" data-tool="cut" title="Cut (Ctrl+X)">Cut</button>
          <button type="button" data-tool="paste" title="Paste (Ctrl+V)">Paste</button>
          <button type="button" data-tool="duplicate" title="Duplicate (Ctrl+D)">Duplicate</button>
          <button type="button" data-tool="delete" title="Delete (Del)">Delete</button>
          <button type="button" data-tool="group" title="Group (Ctrl+G)">Group</button>
          <button type="button" data-tool="ungroup" title="Ungroup (Ctrl+Shift+G)">Ungroup</button>
        </div>
        <div class="lt-group">
          <button type="button" data-tool="align-left" title="Align left">⫷</button>
          <button type="button" data-tool="align-h" title="Align center H">☰</button>
          <button type="button" data-tool="align-right" title="Align right">⫸</button>
          <button type="button" data-tool="align-top" title="Align top">⮭</button>
          <button type="button" data-tool="align-v" title="Align middle">☰</button>
          <button type="button" data-tool="align-bottom" title="Align bottom">﹀</button>
          <button type="button" data-tool="dist-h" title="Distribute H">↔</button>
          <button type="button" data-tool="dist-v" title="Distribute V">↕</button>
          <button type="button" data-tool="align-label-h" title="Center on label H">⌖H</button>
          <button type="button" data-tool="align-label-v" title="Center on label V">⌖V</button>
        </div>
        <div class="lt-group">
          <button type="button" data-tool="grid">Grid</button>
          <button type="button" data-tool="snap">Snap</button>
          <button type="button" data-tool="zoom-out">−</button>
          <span data-zoom>100%</span>
          <button type="button" data-tool="zoom-in">+</button>
          <button type="button" data-tool="zoom-fit">Fit</button>
        </div>
        <div class="lt-group">
          <button type="button" data-tool="undo">Undo</button>
          <button type="button" data-tool="redo">Redo</button>
          <button type="button" data-tool="preset-thermal">Preset thermal</button>
          <button type="button" data-tool="preset-stacked">Preset stacked</button>
          <button type="button" data-tool="preset-qrOnly">QR only</button>
        </div>
      </div>
      <div class="le-body">
        <aside class="le-rail" data-layers></aside>
        <div class="le-canvas-col">
          <div class="le-ruler-h" data-ruler-h></div>
          <div class="le-canvas-row">
            <div class="le-ruler-v" data-ruler-v></div>
            <div class="le-canvas-wrap" data-wrap>
              <div class="le-stage" data-stage>
                <div data-label-host></div>
                <canvas class="le-guides" data-guides></canvas>
                <div class="le-handles" data-handles></div>
              </div>
            </div>
          </div>
          <footer class="le-studio-status" data-status>Ready</footer>
        </div>
        <aside class="le-props">
          <div class="rail-ttl">Inspector</div>
          <div data-inspector></div>
        </aside>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/** Functional open helper for simple call sites. */
export async function openStudio(root, initialDoc, { onChange, onClose } = {}) {
  const studio = new LabelStudio(root, {
    onChange: (doc) => {
      onChange?.(doc);
    }
  });
  const done = root.querySelector("[data-done]");
  const prev = done?.onclick;
  if (done) {
    done.addEventListener(
      "click",
      () => {
        onClose?.();
      },
      { once: true }
    );
  }
  await studio.open(initialDoc);
  return studio;
}

export default LabelStudio;
