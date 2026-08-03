/**
 * label-preview.js — Preview modal using the shared LabelRenderer.
 */
import { renderSheet } from "./label-renderer.js";
import { loadCalibration } from "./label-storage.js";

export class LabelPreview {
  constructor({ host, metaEl, flipToggle } = {}) {
    this.host = host;
    this.metaEl = metaEl;
    this.flipToggle = flipToggle;
    this.items = [];
    this.template = null;
  }

  async show(template, items, { flip = false } = {}) {
    this.template = template;
    this.items = items || [];
    if (this.flipToggle) this.flipToggle.checked = !!flip;
    await this.redraw();
  }

  async redraw() {
    if (!this.host || !this.template) return;
    this.host.innerHTML = "";
    this.host.classList.remove("empty");
    const flip = !!(this.flipToggle && this.flipToggle.checked);
    const sheet = await renderSheet(this.template, this.items, {
      mode: "preview",
      flip,
      applyCalibration: true,
      calibration: loadCalibration(),
      className: "lr-preview-sheet"
    });
    this.host.appendChild(sheet);
    if (this.metaEl) {
      const n = this.items.length;
      this.metaEl.textContent = `${n} label${n === 1 ? "" : "s"} · ${this.template.labelW}×${this.template.labelH} mm · ${this.template.page}`;
    }
  }
}

export default LabelPreview;
