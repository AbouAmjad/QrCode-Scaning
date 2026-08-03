/**
 * label-properties.js — Inspector panel bindings for the selected layer(s).
 */
export function buildPropertiesHtml() {
  return `
  <div class="lp-inspector" id="lpInspector">
    <p class="rail-ttl">Inspector</p>
    <div id="lpEmpty" class="lp-empty">Select an object</div>
    <div id="lpFields" class="lp-fields" hidden>
      <label>Name <input id="pName" type="text"></label>
      <label>X mm <input id="pX" type="number" step="0.1"></label>
      <label>Y mm <input id="pY" type="number" step="0.1"></label>
      <label>W mm <input id="pW" type="number" step="0.1" min="0.5"></label>
      <label>H mm <input id="pH" type="number" step="0.1" min="0.5"></label>
      <label>Rotation <input id="pRot" type="number" step="1"></label>
      <label>Opacity <input id="pOpacity" type="number" step="0.05" min="0" max="1"></label>
      <div class="lp-qr" data-for="qr">
        <label>Padding mm <input id="pPad" type="number" step="0.1" min="0"></label>
        <label>FG color <input id="pFg" type="color"></label>
        <label>BG color <input id="pBg" type="color"></label>
        <label>Corner <input id="pCorner" type="color"></label>
        <label>ECC
          <select id="pEcc"><option>L</option><option>M</option><option>Q</option><option>H</option></select>
        </label>
        <label>Style
          <select id="pQrStyle">
            <option value="square">Square</option>
            <option value="rounded">Rounded</option>
            <option value="extra-rounded">Extra rounded</option>
            <option value="dots">Dots</option>
          </select>
        </label>
      </div>
      <div class="lp-text" data-for="text">
        <label class="span-2">Text <textarea id="pText" rows="2"></textarea></label>
        <label>Font pt <input id="pFont" type="number" step="0.5" min="4"></label>
        <label>Weight <input id="pWeight" type="number" step="100" min="400" max="900"></label>
        <label>Align
          <select id="pAlign"><option>left</option><option>center</option><option>right</option></select>
        </label>
        <label>Tracking <input id="pTrack" type="number" step="0.01"></label>
        <label>Line height <input id="pLH" type="number" step="0.05" min="0.8"></label>
        <label>Color <input id="pColor" type="color"></label>
        <label class="chk"><input id="pWrap" type="checkbox"> Auto wrap</label>
      </div>
      <div class="lp-shape" data-for="shape">
        <label>Fill <input id="pFill" type="color"></label>
        <label>Stroke <input id="pStroke" type="color"></label>
        <label>Stroke mm <input id="pStrokeW" type="number" step="0.05" min="0"></label>
        <label>Radius <input id="pRadius" type="number" step="0.1" min="0"></label>
      </div>
      <div class="lp-image" data-for="image">
        <label class="span-2">Image URL <input id="pSrc" type="text"></label>
        <label>Fit
          <select id="pFit"><option>contain</option><option>cover</option><option>fill</option></select>
        </label>
      </div>
    </div>
  </div>`;
}

export class PropertiesPanel {
  constructor(host, { onChange } = {}) {
    this.host = host;
    this.onChange = onChange;
    this.layer = null;
    this.host.innerHTML = buildPropertiesHtml();
    this.fields = this.host.querySelector("#lpFields");
    this.empty = this.host.querySelector("#lpEmpty");
    this._bind();
  }

  _bind() {
    const ids = [
      "pName","pX","pY","pW","pH","pRot","pOpacity","pPad","pFg","pBg","pCorner",
      "pEcc","pQrStyle","pText","pFont","pWeight","pAlign","pTrack","pLH","pColor",
      "pWrap","pFill","pStroke","pStrokeW","pRadius","pSrc","pFit"
    ];
    for (const id of ids) {
      const el = this.host.querySelector("#" + id);
      if (!el) continue;
      const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, () => this._emit());
    }
  }

  show(layer) {
    this.layer = layer;
    if (!layer) {
      this.fields.hidden = true;
      this.empty.hidden = false;
      return;
    }
    this.empty.hidden = true;
    this.fields.hidden = false;
    const set = (id, v) => {
      const el = this.host.querySelector("#" + id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v ?? "";
    };
    set("pName", layer.name);
    set("pX", layer.x);
    set("pY", layer.y);
    set("pW", layer.w);
    set("pH", layer.h);
    set("pRot", layer.rotation || 0);
    set("pOpacity", layer.opacity == null ? 1 : layer.opacity);
    set("pPad", layer.padding || 0);
    set("pFg", layer.color || "#0f172a");
    set("pBg", layer.bg || "#ffffff");
    set("pCorner", layer.cornerColor || "#0f766e");
    set("pEcc", layer.errorCorrection || "M");
    set("pQrStyle", layer.style || "rounded");
    set("pText", layer.text || "");
    set("pFont", layer.font || 10);
    set("pWeight", layer.weight || 700);
    set("pAlign", layer.align || "left");
    set("pTrack", layer.tracking || 0);
    set("pLH", layer.lineHeight || 1.15);
    set("pColor", layer.color || "#0f172a");
    set("pWrap", layer.wrap !== false);
    set("pFill", layer.fill || "#e2e8f0");
    set("pStroke", layer.stroke || "#0f172a");
    set("pStrokeW", layer.strokeWidth || 0);
    set("pRadius", layer.radius || 0);
    set("pSrc", layer.src || "");
    set("pFit", layer.fit || "contain");

    this.host.querySelectorAll("[data-for]").forEach((block) => {
      block.style.display = block.getAttribute("data-for") === layer.type ? "" : "none";
    });
  }

  _emit() {
    if (!this.layer) return;
    const g = (id) => this.host.querySelector("#" + id);
    const num = (id) => Number(g(id).value);
    const patch = {
      name: g("pName").value,
      x: num("pX"),
      y: num("pY"),
      w: num("pW"),
      h: num("pH"),
      rotation: num("pRot"),
      opacity: num("pOpacity")
    };
    if (this.layer.type === "qr") {
      Object.assign(patch, {
        padding: num("pPad"),
        color: g("pFg").value,
        bg: g("pBg").value,
        cornerColor: g("pCorner").value,
        errorCorrection: g("pEcc").value,
        style: g("pQrStyle").value
      });
    }
    if (this.layer.type === "text") {
      Object.assign(patch, {
        text: g("pText").value,
        font: num("pFont"),
        weight: num("pWeight"),
        align: g("pAlign").value,
        tracking: num("pTrack"),
        lineHeight: num("pLH"),
        color: g("pColor").value,
        wrap: g("pWrap").checked
      });
    }
    if (this.layer.type === "shape" || this.layer.type === "background") {
      Object.assign(patch, {
        fill: g("pFill").value,
        stroke: g("pStroke").value,
        strokeWidth: num("pStrokeW"),
        radius: num("pRadius")
      });
    }
    if (this.layer.type === "image") {
      Object.assign(patch, { src: g("pSrc").value, fit: g("pFit").value });
    }
    this.onChange?.(this.layer.id, patch);
  }
}

export default PropertiesPanel;
