/**
 * label-app.js — Page bootstrap for qr-labels.html
 * Wires templates, studio, preview, print, picker, calibration.
 */
import { LabelEditor } from "./label-editor.js";
import { LabelPreview } from "./label-preview.js";
import { printLabels } from "./label-print.js";
import { createTemplate, normalizeTemplate, PAGE_MODES } from "./label-model.js";
import * as LabelApi from "./label-api.js";
import {
  getLastTemplateId,
  setLastTemplateId,
  loadCalibration
} from "./label-storage.js";
import { mountCalibrationWizard } from "./label-calibration.js";
import { parseCodeLines, itemsToText, downloadJson } from "./label-export.js";
import { ensureQrLibrary } from "./label-renderer.js";

function t(key, fallback) {
  if (typeof TCI18N !== "undefined" && TCI18N.t) return TCI18N.t(key) || fallback || key;
  return fallback || key;
}

function toast(msg, kind = "ok") {
  if (typeof TCUI !== "undefined" && TCUI.toast) TCUI.toast(msg, kind);
  else console.log(`[${kind}]`, msg);
}

export async function bootLabelApp() {
  await ensureQrLibrary().catch((e) => console.warn(e));

  let templates = [];
  let activeId = null;
  let template = createTemplate();
  let lastItems = [];
  let pickerTab = "tools";
  let pickerItems = [];
  let pickerTicks = new Set();

  const editorHost = document.getElementById("editorHost");
  const editor = new LabelEditor(editorHost, {
    onChange: (tpl) => {
      template = normalizeTemplate(tpl);
      syncSizeFields();
    }
  });

  const preview = new LabelPreview({
    host: document.getElementById("labels"),
    metaEl: document.getElementById("previewMeta"),
    flipToggle: document.getElementById("previewFlip")
  });
  document.getElementById("previewFlip")?.addEventListener("change", () => preview.redraw());

  function syncSizeFields() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set("cW", template.labelW);
    set("cH", template.labelH);
    set("cCols", template.cols);
    set("cRows", template.rows);
    set("cGap", template.gapX);
    set("cMargin", template.marginX);
    set("cOrient", template.orientation);
    document.getElementById("activeMeta").textContent =
      `${template.labelW}×${template.labelH} mm · ${template.page}`;
    document.getElementById("activeModeChipTxt").textContent =
      template.page === "a4" ? "A4" : template.page === "a3" ? "A3" : "Thermal";
    document.querySelectorAll("#printMode .ql-mode-card").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === template.page);
    });
    const thermal = template.page === "thermal";
    document.getElementById("orientField").style.display = thermal ? "none" : "";
    document.getElementById("colsField").style.display = thermal ? "none" : "";
    document.getElementById("rowsField").style.display = thermal ? "none" : "";
  }

  function readSizeFieldsIntoTemplate() {
    template = normalizeTemplate({
      ...template,
      labelW: Number(document.getElementById("cW").value) || 50,
      labelH: Number(document.getElementById("cH").value) || 30,
      cols: Number(document.getElementById("cCols").value) || 4,
      rows: Number(document.getElementById("cRows").value) || 6,
      gapX: Number(document.getElementById("cGap").value) || 0,
      gapY: Number(document.getElementById("cGap").value) || 0,
      marginX: Number(document.getElementById("cMargin").value) || 0,
      marginY: Number(document.getElementById("cMargin").value) || 0,
      orientation: document.getElementById("cOrient").value,
      layers: template.layers,
      style: template.style
    });
    syncSizeFields();
  }

  ["cW", "cH", "cCols", "cRows", "cGap", "cMargin", "cOrient"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", readSizeFieldsIntoTemplate);
  });

  document.querySelectorAll("#printMode .ql-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.mode;
      const mode = PAGE_MODES[page] || PAGE_MODES.thermal;
      template = normalizeTemplate({
        ...template,
        page,
        pageW: mode.pageW,
        pageH: mode.pageH,
        cols: mode.cols,
        rows: mode.rows,
        thermal: page === "thermal"
      });
      syncSizeFields();
    });
  });

  function renderTemplateList() {
    const host = document.getElementById("tplList");
    if (!templates.length) {
      host.innerHTML = `<div class="ql-empty-tpl">${t("noTemplatesYet", "No templates yet")}</div>`;
      return;
    }
    host.innerHTML = templates
      .map((tpl) => {
        let cfg = tpl.config || {};
        if (typeof cfg === "string") {
          try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
        return `<button type="button" class="ql-tpl ${tpl.id === activeId ? "active" : ""}" data-id="${tpl.id}">
          <div>
            <div class="name">${escapeHtml(tpl.name)}</div>
            <div class="meta">${cfg.labelW || "?"}×${cfg.labelH || "?"} · ${cfg.page || "thermal"}</div>
          </div>
          <span class="del" data-del="${tpl.id}" title="Delete">✕</span>
        </button>`;
      })
      .join("");
  }

  async function loadTemplates() {
    const host = document.getElementById("tplList");
    host.innerHTML = `<div class="ql-empty-tpl">${t("loading", "Loading…")}</div>`;
    try {
      templates = await LabelApi.listTemplates();
      renderTemplateList();
      const last = getLastTemplateId();
      const pick = templates.find((x) => x.id === last) || templates[0];
      if (pick) applyServerTemplate(pick);
      else {
        template = createTemplate();
        activeId = null;
        document.getElementById("activeNameLabel").textContent = t("unsavedTemplate", "New unsaved template");
        syncSizeFields();
      }
    } catch (e) {
      host.innerHTML = `<div class="ql-empty-tpl">${escapeHtml(e.message || e)}</div>`;
    }
  }

  function applyServerTemplate(item) {
    activeId = item.id;
    setLastTemplateId(item.id);
    let cfg = item.config;
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    }
    template = normalizeTemplate(cfg || {});
    document.getElementById("activeNameLabel").textContent = item.name;
    syncSizeFields();
    renderTemplateList();
  }

  document.getElementById("tplList").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = Number(del.dataset.del);
      const tpl = templates.find((x) => x.id === id);
      if (!tpl) return;
      if (!confirm(t("deleteTemplateConfirm", `Delete “${tpl.name}”?`).replace("{name}", tpl.name))) return;
      try {
        await LabelApi.deleteTemplate(id);
        templates = templates.filter((x) => x.id !== id);
        if (activeId === id) {
          activeId = null;
          setLastTemplateId(null);
        }
        renderTemplateList();
        toast(t("templateDeleted", "Deleted"), "ok");
      } catch (err) {
        toast(err.message || err, "err");
      }
      return;
    }
    const btn = e.target.closest(".ql-tpl");
    if (!btn) return;
    const item = templates.find((x) => String(x.id) === btn.dataset.id);
    if (item) applyServerTemplate(item);
  });

  document.getElementById("btnNewTpl").onclick = () => {
    activeId = null;
    template = createTemplate();
    document.getElementById("activeNameLabel").textContent = t("unsavedTemplate", "New unsaved template");
    syncSizeFields();
    renderTemplateList();
    editor.open(template);
  };

  document.getElementById("btnOpenStudio").onclick = () => {
    readSizeFieldsIntoTemplate();
    editor.open(template);
  };
  // Extra binding — some environments swallow the first onclick assignment
  document.getElementById("btnOpenStudio").addEventListener("click", (e) => {
    e.preventDefault();
    readSizeFieldsIntoTemplate();
    editor.open(template);
  });

  async function saveTpl(forceNew) {
    readSizeFieldsIntoTemplate();
    let name = "";
    const existing = templates.find((x) => x.id === activeId);
    if (!forceNew && existing) name = existing.name;
    else {
      name = prompt(t("templateNamePrompt", "Template name"), existing ? existing.name + " copy" : "");
      if (name == null) return;
      name = String(name).trim();
    }
    if (!name) {
      toast(t("templateNameRequired", "Enter a template name"), "err");
      return;
    }
    try {
      const item = await LabelApi.saveTemplate(name, template, !forceNew && activeId ? activeId : null);
      const idx = templates.findIndex((x) => x.id === item.id);
      if (idx >= 0) templates[idx] = item;
      else templates.unshift(item);
      applyServerTemplate(item);
      toast(t("templateSaved", `Saved “${name}”`).replace("{name}", name), "ok");
    } catch (e) {
      toast(e.message || e, "err");
    }
  }

  document.getElementById("btnSaveTpl").onclick = () => saveTpl(false);
  document.getElementById("btnSaveAsTpl").onclick = () => saveTpl(true);

  function setPreviewBtn(on) {
    document.getElementById("btnOpenPreview").disabled = !on;
  }

  document.getElementById("btnGen").onclick = async () => {
    readSizeFieldsIntoTemplate();
    lastItems = parseCodeLines(document.getElementById("codes").value);
    if (!lastItems.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    try {
      await preview.show(template, lastItems, {
        flip: document.getElementById("previewFlip")?.checked
      });
      setPreviewBtn(true);
      openPreview();
      toast(t("labelsGenerated", "Labels generated"), "ok");
    } catch (e) {
      console.error(e);
      toast(e.message || e, "err");
    }
  };

  document.getElementById("btnClear").onclick = () => {
    document.getElementById("codes").value = "";
    lastItems = [];
    document.getElementById("labels").innerHTML =
      `<span class="labels-empty-msg">${t("labelsPreviewEmpty", "Generate labels to preview")}</span>`;
    document.getElementById("labels").classList.add("empty");
    setPreviewBtn(false);
    updateSelectedBar();
  };

  function openPreview() {
    document.getElementById("previewModal").classList.add("open");
  }
  function closePreview() {
    document.getElementById("previewModal").classList.remove("open");
  }
  document.getElementById("btnOpenPreview").onclick = openPreview;
  document.getElementById("btnClosePreview").onclick = closePreview;
  document.getElementById("btnClosePreview2").onclick = closePreview;

  document.getElementById("btnPrint").onclick = async () => {
    if (!lastItems.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    try {
      await printLabels(template, lastItems, {
        flip: !!document.getElementById("previewFlip")?.checked
      });
    } catch (e) {
      toast(e.message || e, "err");
    }
  };

  document.getElementById("btnDir").onclick = () => {
    const ta = document.getElementById("codes");
    const extra = "IN | Direction IN\nOUT | Direction OUT";
    ta.value = ta.value.trim() ? ta.value.trim() + "\n" + extra : extra;
    updateSelectedBar();
  };

  function updateSelectedBar() {
    const items = parseCodeLines(document.getElementById("codes").value);
    const bar = document.getElementById("selectedBar");
    document.getElementById("selectedCount").textContent = String(items.length);
    bar.style.display = items.length ? "" : "none";
  }
  document.getElementById("codes").addEventListener("input", updateSelectedBar);

  // Picker
  const pickerModal = document.getElementById("pickerModal");
  document.getElementById("btnPick").onclick = () => openPicker();
  document.getElementById("btnClosePicker").onclick = () => pickerModal.classList.remove("open");

  async function openPicker() {
    pickerModal.classList.add("open");
    pickerTicks = new Set();
    await loadPickerTab(pickerTab);
  }

  document.getElementById("pickerTabs").onclick = async (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    pickerTab = btn.dataset.tab;
    document.querySelectorAll("#pickerTabs button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    await loadPickerTab(pickerTab);
  };

  async function loadPickerTab(tab) {
    const list = document.getElementById("pickerList");
    list.innerHTML = `<div class="ql-hint">${t("loading", "Loading…")}</div>`;
    try {
      if (tab === "people") {
        const people = await LabelApi.listPeople();
        pickerItems = people.map((p) => ({
          code: p.code,
          name: p.name || p.fullName || "",
          kind: "person"
        }));
      } else {
        const catalog = await LabelApi.listCatalog();
        pickerItems = catalog
          .filter((it) => {
            const k = String(it.kind || it.category || "").toLowerCase();
            const code = String(it.code || "");
            if (tab === "consumables") {
              return k.includes("consum") || code.startsWith("C") || code.startsWith("B");
            }
            return !code.startsWith("P") && !(k.includes("consum") || code.startsWith("C"));
          })
          .map((it) => ({
            code: it.code,
            name: it.description || it.name || "",
            kind: "tool"
          }));
      }
      renderPickerList();
    } catch (e) {
      list.innerHTML = `<div class="ql-hint">${escapeHtml(e.message || e)}</div>`;
    }
  }

  function filteredPickerItems() {
    const q = String(document.getElementById("pickerSearch").value || "")
      .trim()
      .toUpperCase();
    if (!q) return pickerItems;
    return pickerItems.filter(
      (it) =>
        String(it.code).toUpperCase().includes(q) ||
        String(it.name).toUpperCase().includes(q)
    );
  }

  function renderPickerList() {
    const list = document.getElementById("pickerList");
    const items = filteredPickerItems();
    list.innerHTML = items
      .map(
        (it) => `<label class="ql-picker-row">
        <input type="checkbox" data-code="${escapeHtml(it.code)}" ${pickerTicks.has(it.code) ? "checked" : ""}>
        <span><strong>${escapeHtml(it.code)}</strong> · ${escapeHtml(it.name || "")}</span>
      </label>`
      )
      .join("") || `<div class="ql-hint">${t("noResults", "No results")}</div>`;
    list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) pickerTicks.add(cb.dataset.code);
        else pickerTicks.delete(cb.dataset.code);
        document.getElementById("pickerTickCount").textContent = String(pickerTicks.size);
      };
    });
    document.getElementById("pickerTickCount").textContent = String(pickerTicks.size);
  }

  document.getElementById("pickerSearch").oninput = () => renderPickerList();
  document.getElementById("btnSelectFiltered").onclick = () => {
    filteredPickerItems().forEach((it) => pickerTicks.add(it.code));
    renderPickerList();
  };
  document.getElementById("btnClearSelection").onclick = () => {
    pickerTicks.clear();
    renderPickerList();
  };

  function applyPicker(mode) {
    const chosen = pickerItems.filter((it) => pickerTicks.has(it.code));
    const ta = document.getElementById("codes");
    const text = itemsToText(chosen);
    if (mode === "replace") ta.value = text;
    else ta.value = ta.value.trim() ? ta.value.trim() + "\n" + text : text;
    updateSelectedBar();
    pickerModal.classList.remove("open");
  }
  document.getElementById("btnApplyReplace").onclick = () => applyPicker("replace");
  document.getElementById("btnApplyAdd").onclick = () => applyPicker("add");

  // Calibration wizard
  document.getElementById("btnCalibrate").onclick = () => {
    const modal = document.getElementById("calibModal");
    modal.classList.add("open");
    mountCalibrationWizard(document.getElementById("calibHost"), {
      labelW: template.labelW,
      labelH: template.labelH,
      onSaved: () => toast(t("calibSaved", "Printer profile saved"), "ok")
    });
  };
  document.getElementById("btnCloseCalib").onclick = () =>
    document.getElementById("calibModal").classList.remove("open");

  document.getElementById("btnExportJson")?.addEventListener("click", () => {
    downloadJson(template, `label-${template.labelW}x${template.labelH}.json`);
  });

  // Show active calibration chip
  const cal = loadCalibration();
  const chip = document.getElementById("calibChip");
  if (chip) {
    chip.textContent = `${cal.printerName} · ${cal.dpi}dpi · scale ${cal.scale}`;
  }

  syncSizeFields();
  await loadTemplates();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export default { bootLabelApp };
