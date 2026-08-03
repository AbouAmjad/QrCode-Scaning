/**
 * label-editor.js — Design Studio orchestrator.
 * Single source of truth for template state; paints via LabelRenderer only.
 */
import {
  createTemplate,
  createLayer,
  normalizeTemplate,
  layoutPresets,
  cloneLayers
} from "./label-model.js";
import {
  contentBox,
  clampLayerMm,
  alignLayers,
  distributeLayers,
  roundMm
} from "./label-layout-engine.js";
import { renderLabel, ensureQrLibrary } from "./label-renderer.js";
import { HistoryManager } from "./label-history.js";
import { SelectionManager } from "./label-selection.js";
import { GuidesController } from "./label-guides.js";
import { PropertiesPanel } from "./label-properties.js";
import { LabelToolbar } from "./label-toolbar.js";
import { bindShortcuts } from "./label-shortcuts.js";
import {
  getStudioZoom,
  setStudioZoom,
  getGridMm,
  setGridMm
} from "./label-storage.js";

export class LabelEditor {
  constructor(root, { onChange } = {}) {
    this.root = root;
    this.onChange = onChange;
    this.template = createTemplate();
    this.history = new HistoryManager();
    this.selection = new SelectionManager();
    this.guides = new GuidesController({ gridMm: getGridMm() });
    this.zoom = getStudioZoom(); // 1 = 100%, or 'fit'
    this.pxPerMm = 4;
    this._raf = 0;
    this._drag = null;
    this._clipboard = null;
    this._open = false;

    this.root.innerHTML = `
      <div class="le-studio" hidden>
        <header class="le-head">
          <div>
            <h3>Design Studio</h3>
            <div class="meta" id="leMeta">50×30 mm</div>
          </div>
          <div class="le-head-actions">
            <button type="button" class="tc-btn" id="leReset">Reset</button>
            <button type="button" class="tc-btn tc-btn-primary" id="leDone">Done</button>
          </div>
        </header>
        <div id="leToolbarHost"></div>
        <div class="le-body">
          <aside class="le-rail" id="leLayers"></aside>
          <div class="le-canvas-col">
            <div class="le-ruler-h" id="leRulerH"></div>
            <div class="le-canvas-row">
              <div class="le-ruler-v" id="leRulerV"></div>
              <div class="le-canvas-wrap" id="leWrap">
                <div class="le-stage" id="leStage">
                  <div id="leLabelHost"></div>
                  <canvas id="leGuides" class="le-guides"></canvas>
                  <div id="leHandles" class="le-handles"></div>
                </div>
              </div>
            </div>
          </div>
          <aside class="le-props" id="leProps"></aside>
        </div>
      </div>`;

    this.toolbar = new LabelToolbar(this.root.querySelector("#leToolbarHost"), {
      add: (t) => this.addLayer(t),
      align: (m) => this.align(m),
      zoom: (d) => this.nudgeZoom(d),
      setZoom: (v) => this.setZoom(v),
      setGrid: (g) => this.setGrid(g),
      undo: () => this.undo(),
      redo: () => this.redo(),
      preset: (p) => this.applyPreset(p)
    });

    this.props = new PropertiesPanel(this.root.querySelector("#leProps"), {
      onChange: (id, patch) => this.patchLayer(id, patch, true)
    });

    this.root.querySelector("#leDone").onclick = () => this.close();
    this.root.querySelector("#leReset").onclick = () => {
      this.template.layers = layoutPresets().thermal();
      this.commit("reset");
      this.schedulePaint();
    };

    this._unbindShortcuts = bindShortcuts(
      {
        undo: () => this.undo(),
        redo: () => this.redo(),
        copy: () => this.copy(),
        cut: () => this.cut(),
        paste: () => this.paste(),
        duplicate: () => this.duplicate(),
        delete: () => this.deleteSelected(),
        selectAll: () => {
          this.selection.selectAll(this.template.layers);
          this.schedulePaint();
        },
        group: () => {
          this.template.layers = this.selection.group(this.template.layers);
          this.commit("group");
          this.schedulePaint();
        },
        ungroup: () => {
          this.template.layers = this.selection.ungroup(this.template.layers);
          this.commit("ungroup");
          this.schedulePaint();
        },
        nudge: (dx, dy) => {
          this.template.layers = this.selection.nudge(
            this.template.layers,
            dx,
            dy,
            this.template,
            this.guides.snapToGrid ? this.guides.gridMm : 0
          );
          this.commit("nudge");
          this.schedulePaint();
        },
        zoom: (dir) => this.nudgeZoom(dir)
      },
      { isEnabled: () => this._open }
    );

    this._bindPointer();
  }

  get isOpen() {
    return this._open;
  }

  open(template) {
    this.template = normalizeTemplate(template || createTemplate());
    this.history.reset(this.snapshot(), "open");
    this.selection.clear();
    this._open = true;
    this.root.querySelector(".le-studio").hidden = false;
    this.root.querySelector(".le-studio").classList.add("open");
    ensureQrLibrary().finally(() => this.schedulePaint(true));
  }

  close() {
    this._open = false;
    this.root.querySelector(".le-studio").hidden = true;
    this.root.querySelector(".le-studio").classList.remove("open");
    this.onChange?.(this.template);
  }

  snapshot() {
    return {
      template: JSON.parse(JSON.stringify(this.template))
    };
  }

  commit(label) {
    this.history.push(this.snapshot(), label);
    this.onChange?.(this.template);
  }

  undo() {
    const snap = this.history.undo();
    if (!snap) return;
    this.template = normalizeTemplate(snap.template);
    this.schedulePaint();
    this.onChange?.(this.template);
  }

  redo() {
    const snap = this.history.redo();
    if (!snap) return;
    this.template = normalizeTemplate(snap.template);
    this.schedulePaint();
    this.onChange?.(this.template);
  }

  addLayer(type) {
    const ly = createLayer(type);
    this.template.layers = [...this.template.layers, ly];
    this.selection.set([ly.id]);
    this.commit("add");
    this.schedulePaint();
  }

  patchLayer(id, patch, commit = false) {
    const box = contentBox(this.template);
    this.template.layers = this.template.layers.map((l) => {
      if (l.id !== id) return l;
      return clampLayerMm({ ...l, ...patch, unit: "mm" }, box);
    });
    if (commit) this.commit("props");
    this.schedulePaint();
  }

  align(mode) {
    const selected = this.selection.selectedLayers(this.template.layers);
    if (!selected.length) return;
    const box = contentBox(this.template);
    let updated;
    if (mode === "distributeH") {
      updated = distributeLayers(selected, "h");
    } else {
      updated = alignLayers(selected, mode, box);
    }
    const map = new Map(updated.map((l) => [l.id, l]));
    this.template.layers = this.template.layers.map((l) => map.get(l.id) || l);
    this.commit("align");
    this.schedulePaint();
  }

  applyPreset(name) {
    const presets = layoutPresets();
    const fn = presets[name];
    if (!fn) return;
    this.template.layers = fn();
    this.selection.clear();
    this.commit("preset");
    this.schedulePaint();
  }

  setGrid(mm) {
    this.guides.setGrid(mm);
    setGridMm(mm);
    this.schedulePaint();
  }

  setZoom(value) {
    this.zoom = value === "fit" ? "fit" : Number(value) || 1;
    if (this.zoom !== "fit") setStudioZoom(this.zoom);
    this.toolbar.setZoomLabel(value);
    this.schedulePaint(true);
  }

  nudgeZoom(dir) {
    const steps = [0.25, 0.5, 0.75, 1, 1.5, 2, 4];
    let cur = this.zoom === "fit" ? 1 : Number(this.zoom) || 1;
    let idx = steps.findIndex((s) => s >= cur - 0.001);
    if (idx < 0) idx = 2;
    idx = Math.max(0, Math.min(steps.length - 1, idx + (dir > 0 ? 1 : -1)));
    this.setZoom(steps[idx]);
  }

  copy() {
    this._clipboard = cloneLayers(this.selection.selectedLayers(this.template.layers));
  }

  cut() {
    this.copy();
    this.deleteSelected();
  }

  paste() {
    if (!this._clipboard?.length) return;
    const copies = this._clipboard.map((ly) => ({
      ...JSON.parse(JSON.stringify(ly)),
      id: `ly-${Math.random().toString(36).slice(2, 8)}`,
      x: roundMm(Number(ly.x) + 2),
      y: roundMm(Number(ly.y) + 2)
    }));
    this.template.layers = [...this.template.layers, ...copies];
    this.selection.set(copies.map((c) => c.id));
    this.commit("paste");
    this.schedulePaint();
  }

  duplicate() {
    this.template.layers = this.selection.duplicate(this.template.layers);
    this.commit("duplicate");
    this.schedulePaint();
  }

  deleteSelected() {
    this.template.layers = this.selection.deleteSelected(this.template.layers);
    this.commit("delete");
    this.schedulePaint();
  }

  schedulePaint(fit = false) {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.paint(fit));
  }

  _computePxPerMm(wrap) {
    const tpl = this.template;
    if (this.zoom === "fit" && wrap) {
      const pad = 48;
      const availW = Math.max(120, wrap.clientWidth - pad);
      const availH = Math.max(120, wrap.clientHeight - pad);
      return Math.max(1.5, Math.min(availW / tpl.labelW, availH / tpl.labelH));
    }
    // 96 CSS dpi baseline → mm
    return ((Number(this.zoom) || 1) * 96) / 25.4;
  }

  async paint() {
    if (!this._open) return;
    const wrap = this.root.querySelector("#leWrap");
    const host = this.root.querySelector("#leLabelHost");
    const stage = this.root.querySelector("#leStage");
    const canvas = this.root.querySelector("#leGuides");
    const meta = this.root.querySelector("#leMeta");
    this.pxPerMm = this._computePxPerMm(wrap);
    meta.textContent = `${this.template.labelW}×${this.template.labelH} mm · ${Math.round(this.pxPerMm * 25.4)}% screen`;

    // Stage size in screen px (visual only)
    const sw = this.template.labelW * this.pxPerMm;
    const sh = this.template.labelH * this.pxPerMm;
    stage.style.width = `${sw}px`;
    stage.style.height = `${sh}px`;

    // Render label at TRUE mm; scale wrapper to match stage
    host.innerHTML = "";
    const label = await renderLabel(this.template, { code: "I1001", name: "Sample tool" }, {
      mode: "editor",
      applyCalibration: false,
      interactive: true,
      className: "le-live-label"
    });
    // Scale mm→screen without mutating geometry
    const scale = this.pxPerMm / (96 / 25.4);
    label.style.transform = `scale(${scale})`;
    label.style.transformOrigin = "top left";
    host.appendChild(label);

    canvas.width = Math.ceil(sw);
    canvas.height = Math.ceil(sh);
    canvas.style.width = `${sw}px`;
    canvas.style.height = `${sh}px`;
    const ctx = canvas.getContext("2d");
    this.guides.paint(
      ctx,
      this.template,
      this.pxPerMm,
      this.selection.selectedLayers(this.template.layers)
    );
    this.guides.renderRulers(
      this.root.querySelector("#leRulerH"),
      this.root.querySelector("#leRulerV"),
      this.template,
      this.pxPerMm
    );

    this._renderLayersPanel();
    this._renderHandles();
    const sel = this.selection.selectedLayers(this.template.layers)[0];
    this.props.show(sel || null);
  }

  _renderLayersPanel() {
    const host = this.root.querySelector("#leLayers");
    const layers = [...this.template.layers].sort((a, b) => (b.z || 0) - (a.z || 0));
    host.innerHTML = `<p class="rail-ttl">Layers</p>` + layers.map((l) => `
      <div class="le-layer ${this.selection.has(l.id) ? "active" : ""}" data-id="${l.id}">
        <button type="button" data-act="vis" title="Visibility">${l.visible === false ? "🙈" : "👁"}</button>
        <button type="button" data-act="lock" title="Lock">${l.locked ? "🔒" : "🔓"}</button>
        <span class="name">${escapeHtml(l.name || l.type)}</span>
        <button type="button" data-act="up">↑</button>
        <button type="button" data-act="down">↓</button>
      </div>`).join("");

    host.onclick = (e) => {
      const row = e.target.closest(".le-layer");
      if (!row) return;
      const id = row.dataset.id;
      const act = e.target.closest("button")?.dataset.act;
      if (act === "vis") {
        this.template.layers = this.template.layers.map((l) =>
          l.id === id ? { ...l, visible: l.visible === false } : l
        );
        this.commit("vis");
      } else if (act === "lock") {
        this.template.layers = this.template.layers.map((l) =>
          l.id === id ? { ...l, locked: !l.locked } : l
        );
        this.commit("lock");
      } else if (act === "up") {
        this.template.layers = this.selection.reorder(this.template.layers, id, "up");
        this.commit("z");
      } else if (act === "down") {
        this.template.layers = this.selection.reorder(this.template.layers, id, "down");
        this.commit("z");
      } else {
        this.selection.toggle(id, e.shiftKey);
      }
      this.schedulePaint();
    };
  }

  _renderHandles() {
    const host = this.root.querySelector("#leHandles");
    const box = contentBox(this.template);
    const selected = this.selection.selectedLayers(this.template.layers);
    host.innerHTML = "";
    for (const ly of selected) {
      const left = (box.ox + Number(ly.x)) * this.pxPerMm;
      const top = (box.oy + Number(ly.y)) * this.pxPerMm;
      const w = Number(ly.w) * this.pxPerMm;
      const h = Number(ly.h) * this.pxPerMm;
      const boxEl = document.createElement("div");
      boxEl.className = "le-sel-box";
      boxEl.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;`;
      boxEl.dataset.id = ly.id;
      if (!ly.locked) {
        for (const hnd of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
          const d = document.createElement("div");
          d.className = `le-hnd le-hnd-${hnd}`;
          d.dataset.handle = hnd;
          d.dataset.id = ly.id;
          boxEl.appendChild(d);
        }
        const rot = document.createElement("div");
        rot.className = "le-hnd le-hnd-rot";
        rot.dataset.handle = "rot";
        rot.dataset.id = ly.id;
        boxEl.appendChild(rot);
      }
      host.appendChild(boxEl);
    }
  }

  _bindPointer() {
    const wrap = () => this.root.querySelector("#leWrap");
    const stage = () => this.root.querySelector("#leStage");

    const toMm = (clientX, clientY) => {
      const rect = stage().getBoundingClientRect();
      const xPx = clientX - rect.left;
      const yPx = clientY - rect.top;
      const box = contentBox(this.template);
      return {
        x: xPx / this.pxPerMm - box.ox,
        y: yPx / this.pxPerMm - box.oy
      };
    };

    this.root.addEventListener("pointerdown", (e) => {
      if (!this._open) return;
      const hnd = e.target.closest(".le-hnd");
      const selBox = e.target.closest(".le-sel-box");
      const layerEl = e.target.closest(".lr-interactive");
      if (hnd) {
        const id = hnd.dataset.id;
        this._drag = {
          type: hnd.dataset.handle === "rot" ? "rotate" : "resize",
          handle: hnd.dataset.handle,
          id,
          start: toMm(e.clientX, e.clientY),
          origin: this.template.layers.find((l) => l.id === id)
        };
        e.preventDefault();
        return;
      }
      if (selBox && !hnd) {
        const id = selBox.dataset.id;
        const ly = this.template.layers.find((l) => l.id === id);
        if (ly && !ly.locked) {
          this._drag = {
            type: "move",
            ids: this.selection.has(id) ? this.selection.selectedIds : [id],
            start: toMm(e.clientX, e.clientY),
            origins: Object.fromEntries(
              this.template.layers
                .filter((l) => (this.selection.has(id) ? this.selection.has(l.id) : l.id === id))
                .map((l) => [l.id, { x: l.x, y: l.y, w: l.w, h: l.h }])
            )
          };
          if (!this.selection.has(id)) this.selection.set([id]);
        }
        e.preventDefault();
        return;
      }
      if (layerEl) {
        const id = layerEl.getAttribute("data-layer-id");
        this.selection.toggle(id, e.shiftKey);
        this.schedulePaint();
        return;
      }
      if (e.target.closest("#leStage") || e.target.closest("#leGuides")) {
        if (!e.shiftKey) this.selection.clear();
        this.schedulePaint();
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (!this._drag) return;
      const cur = toMm(e.clientX, e.clientY);
      const dx = cur.x - this._drag.start.x;
      const dy = cur.y - this._drag.start.y;
      if (this._drag.type === "move") {
        const others = this.template.layers.filter((l) => !this._drag.ids.includes(l.id));
        this.template.layers = this.template.layers.map((l) => {
          if (!this._drag.ids.includes(l.id) || l.locked) return l;
          const o = this._drag.origins[l.id];
          let x = Number(o.x) + dx;
          let y = Number(o.y) + dy;
          const snapped = this.guides.snapPosition(x, y, Number(o.w), Number(o.h), this.template, others);
          return clampLayerMm({ ...l, x: snapped.x, y: snapped.y, unit: "mm" }, contentBox(this.template));
        });
      } else if (this._drag.type === "resize") {
        // Rebuild from origin each move so deltas stay absolute (no drift).
        const origin = this._drag.origin;
        const temp = this.template.layers.map((l) =>
          l.id === this._drag.id ? { ...origin } : l
        );
        this.template.layers = this.selection.resize(
          temp,
          this._drag.id,
          this._drag.handle,
          dx,
          dy,
          this.template,
          e.shiftKey
        );
      } else if (this._drag.type === "rotate") {
        const origin = this._drag.origin;
        const cx = Number(origin.x) + Number(origin.w) / 2;
        const cy = Number(origin.y) + Number(origin.h) / 2;
        const ang = (Math.atan2(cur.y - cy, cur.x - cx) * 180) / Math.PI;
        this.template.layers = this.template.layers.map((l) =>
          l.id === this._drag.id ? { ...l, rotation: roundMm(ang, 1) } : l
        );
      }
      this.schedulePaint();
    });

    window.addEventListener("pointerup", () => {
      if (!this._drag) return;
      this._drag = null;
      this.commit("drag");
      this.schedulePaint();
    });

    void wrap;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export default LabelEditor;
