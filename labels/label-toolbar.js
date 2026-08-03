/**
 * label-toolbar.js — Studio tool buttons: add, align, zoom, presets.
 */
export function buildToolbarHtml() {
  return `
  <div class="lt-toolbar" id="ltToolbar">
    <div class="lt-group">
      <button type="button" data-add="qr" title="QR"><i class="bi bi-qr-code"></i></button>
      <button type="button" data-add="text" title="Text"><i class="bi bi-fonts"></i></button>
      <button type="button" data-add="image" title="Image"><i class="bi bi-image"></i></button>
      <button type="button" data-add="shape" title="Shape"><i class="bi bi-square"></i></button>
      <button type="button" data-add="line" title="Line"><i class="bi bi-dash-lg"></i></button>
    </div>
    <div class="lt-group">
      <button type="button" data-align="left" title="Align left"><i class="bi bi-align-start"></i></button>
      <button type="button" data-align="centerH" title="Align center H"><i class="bi bi-align-center"></i></button>
      <button type="button" data-align="right" title="Align right"><i class="bi bi-align-end"></i></button>
      <button type="button" data-align="top" title="Align top"><i class="bi bi-align-top"></i></button>
      <button type="button" data-align="centerV" title="Align center V"><i class="bi bi-align-middle"></i></button>
      <button type="button" data-align="bottom" title="Align bottom"><i class="bi bi-align-bottom"></i></button>
      <button type="button" data-align="distributeH" title="Distribute H"><i class="bi bi-distribute-horizontal"></i></button>
    </div>
    <div class="lt-group">
      <button type="button" data-zoom="out" title="Zoom out"><i class="bi bi-zoom-out"></i></button>
      <select id="ltZoomSelect" title="Zoom">
        <option value="fit">Fit</option>
        <option value="0.25">25%</option>
        <option value="0.5">50%</option>
        <option value="0.75">75%</option>
        <option value="1" selected>100%</option>
        <option value="1.5">150%</option>
        <option value="2">200%</option>
        <option value="4">400%</option>
      </select>
      <button type="button" data-zoom="in" title="Zoom in"><i class="bi bi-zoom-in"></i></button>
    </div>
    <div class="lt-group">
      <button type="button" data-hist="undo" title="Undo"><i class="bi bi-arrow-counterclockwise"></i></button>
      <button type="button" data-hist="redo" title="Redo"><i class="bi bi-arrow-clockwise"></i></button>
    </div>
    <div class="lt-group">
      <label class="lt-grid">Grid
        <select id="ltGrid">
          <option value="0.25">0.25 mm</option>
          <option value="0.5">0.5 mm</option>
          <option value="1" selected>1 mm</option>
        </select>
      </label>
    </div>
    <div class="lt-group">
      <button type="button" data-tpl="blank">Blank</button>
      <button type="button" data-tpl="thermal">Thermal</button>
      <button type="button" data-tpl="stacked">Stacked</button>
      <button type="button" data-tpl="qrOnly">QR only</button>
    </div>
  </div>`;
}

export class LabelToolbar {
  constructor(host, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.host.innerHTML = buildToolbarHtml();
    this.host.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.add) handlers.add?.(btn.dataset.add);
      if (btn.dataset.align) handlers.align?.(btn.dataset.align);
      if (btn.dataset.zoom === "in") handlers.zoom?.(1);
      if (btn.dataset.zoom === "out") handlers.zoom?.(-1);
      if (btn.dataset.hist === "undo") handlers.undo?.();
      if (btn.dataset.hist === "redo") handlers.redo?.();
      if (btn.dataset.tpl) handlers.preset?.(btn.dataset.tpl);
    });
    this.host.querySelector("#ltZoomSelect")?.addEventListener("change", (e) => {
      handlers.setZoom?.(e.target.value);
    });
    this.host.querySelector("#ltGrid")?.addEventListener("change", (e) => {
      handlers.setGrid?.(Number(e.target.value));
    });
  }

  setZoomLabel(value) {
    const sel = this.host.querySelector("#ltZoomSelect");
    if (!sel) return;
    const v = String(value);
    if ([...sel.options].some((o) => o.value === v)) sel.value = v;
  }
}

export default LabelToolbar;
