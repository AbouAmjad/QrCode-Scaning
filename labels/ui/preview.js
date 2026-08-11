/**
 * ui/preview.js — preview modal uses the same renderSheet as print.
 */
import { ensureQrLibrary } from "../render/engine.js";
import { renderSheet } from "../render/sheet.js";
import { loadCalibration } from "../data/storage.js";

export class LabelPreview {
  constructor({ host, metaEl, flipToggle } = {}) {
    this.host = host;
    this.metaEl = metaEl;
    this.flipToggle = flipToggle;
    this.doc = null;
    this.items = [];
  }

  async show(doc, items, { flip = false } = {}) {
    await ensureQrLibrary();
    this.doc = doc;
    this.items = items || [];
    if (this.flipToggle) this.flipToggle.checked = !!flip;
    await this.redraw();
  }

  async redraw() {
    if (!this.host || !this.doc) return;
    const flip = !!this.flipToggle?.checked;
    this.host.classList.remove("empty");
    this.host.innerHTML = `<div class="ql-hint">Rendering…</div>`;
    try {
      const sheet = await renderSheet(this.doc, this.items, {
        mode: "preview",
        flip,
        applyCalibration: true,
        calibration: loadCalibration(),
        className: "lr-preview-sheet"
      });
      this.host.innerHTML = "";
      this.host.appendChild(sheet);
      if (this.metaEl) {
        this.metaEl.textContent = `${this.items.length} label(s) · ${this.doc.labelW}×${this.doc.labelH} mm · ${this.doc.page}`;
      }
    } catch (e) {
      console.error("[preview]", e);
      this.host.innerHTML = `<div class="ql-hint">Preview failed: ${escapeHtml(e.message || e)}</div>`;
    }
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export default LabelPreview;
